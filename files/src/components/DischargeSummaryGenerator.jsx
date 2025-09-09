import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  FileText, Download, Copy, AlertCircle, CheckCircle, 
  Upload, Trash2, Wand2, RefreshCw, Edit, Settings,
  Save, Eye, EyeOff, Printer, Shield, Database,
  Activity, Clock, ClipboardList, ChevronDown, ChevronRight,
  Heart, Brain, Zap, FileX, Loader2
} from 'lucide-react';

const DischargeSummaryGenerator = () => {
  // Core State
  const [admissionNote, setAdmissionNote] = useState('');
  const [progressNotes, setProgressNotes] = useState('');
  const [finalNote, setFinalNote] = useState('');
  const [extractedData, setExtractedData] = useState(null);
  const [generatedSummary, setGeneratedSummary] = useState('');
  
  // UI State
  const [activeTab, setActiveTab] = useState('admission');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [success, setSuccess] = useState('');
  const [copied, setCopied] = useState(false);
  
  // Settings
  const [useAI, setUseAI] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [autoSave, setAutoSave] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState('standard');
  
  // Refs
  const fileInputRef = useRef(null);
  const summaryRef = useRef(null);

  // Load saved data on mount
  useEffect(() => {
    const savedData = localStorage.getItem('dischargeSummaryDraft');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed.admissionNote) setAdmissionNote(parsed.admissionNote);
        if (parsed.progressNotes) setProgressNotes(parsed.progressNotes);
        if (parsed.finalNote) setFinalNote(parsed.finalNote);
        setSuccess('Previous draft restored');
        setTimeout(() => setSuccess(''), 3000);
      } catch (e) {
        console.error('Failed to load saved draft');
      }
    }

    // Load API key if saved
    const savedKey = localStorage.getItem('geminiApiKey');
    if (savedKey) {
      setApiKey(savedKey);
      setUseAI(true);
    }
  }, []);

  // Auto-save
  useEffect(() => {
    if (!autoSave) return;
    
    const saveTimer = setTimeout(() => {
      if (admissionNote || progressNotes || finalNote) {
        localStorage.setItem('dischargeSummaryDraft', JSON.stringify({
          admissionNote,
          progressNotes,
          finalNote,
          savedAt: new Date().toISOString()
        }));
      }
    }, 2000);

    return () => clearTimeout(saveTimer);
  }, [admissionNote, progressNotes, finalNote, autoSave]);

  // Pattern-based extraction
  const extractWithPatterns = useCallback(() => {
    const patterns = {
      // Demographics patterns
      patientName: [
        /(?:Patient Name|Patient|Name|Mr\.|Mrs\.|Ms\.|Dr\.)\s*:?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,
        /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+is\s+a\s+\d+/m,
        /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}),?\s+(?:a\s+)?\d{1,3}[\s-]*(?:year|yo)/
      ],
      age: [
        /(\d{1,3})[\s-]*(?:year|years|yo|y\.o\.|y\/o)[\s-]*old/i,
        /(?:Age|AGE)\s*:?\s*(\d{1,3})/i,
        /(?:is\s+a\s+|is\s+an\s+)(\d{1,3})[\s-]*(?:year|yo)/i
      ],
      sex: [
        /\b(male|female|man|woman|M|F)\b/i,
        /(?:Sex|Gender|SEX|GENDER)\s*:?\s*(male|female|M|F)/i
      ],
      mrn: [
        /(?:MRN|Medical Record Number|MR#|Medical Record)\s*:?\s*(\d+)/i,
        /(?:Record|Chart)\s*(?:#|Number)?\s*:?\s*(\d+)/i
      ],
      admitDate: [
        /(?:Admission Date|Date of Admission|Admitted|DOA)\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
        /(?:Admitted on|Admission on)\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i
      ],
      dischargeDate: [
        /(?:Discharge Date|Date of Discharge|DOD|Discharged)\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
        /(?:Discharged on|Discharge on)\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i
      ]
    };

    const tryPatterns = (text, patternList) => {
      for (const pattern of patternList) {
        const match = text.match(pattern);
        if (match && match[1]) {
          return match[1].trim();
        }
      }
      return '';
    };

    const extracted = {
      // Demographics
      patientName: tryPatterns(admissionNote, patterns.patientName),
      age: tryPatterns(admissionNote, patterns.age),
      sex: tryPatterns(admissionNote, patterns.sex),
      mrn: tryPatterns(admissionNote, patterns.mrn),
      
      // Dates
      admitDate: tryPatterns(admissionNote, patterns.admitDate),
      dischargeDate: tryPatterns(finalNote, patterns.dischargeDate),
      
      // Diagnoses
      admittingDiagnosis: '',
      dischargeDiagnosis: '',
      
      // Clinical Info
      procedures: [],
      historyPresenting: '',
      hospitalCourse: '',
      complications: [],
      
      // Current Status
      currentExam: '',
      vitalSigns: '',
      
      // Medications
      dischargeMedications: [],
      
      // History
      allergies: '',
      pmh: [],
      psh: [],
      
      // Discharge Planning
      disposition: 'Home',
      diet: 'Regular',
      activity: 'As tolerated',
      followUp: []
    };

    // Extract diagnoses
    const admitDxMatch = admissionNote.match(/(?:Chief Complaint|CC|Presenting Problem|Reason for Admission|Admitting Diagnosis)\s*:?\s*([^\n]+)/i);
    if (admitDxMatch) extracted.admittingDiagnosis = admitDxMatch[1].trim();

    const dischargeDxMatch = finalNote.match(/(?:Discharge Diagnosis|Final Diagnosis|Primary Diagnosis)\s*:?\s*([^\n]+)/i);
    if (dischargeDxMatch) extracted.dischargeDiagnosis = dischargeDxMatch[1].trim();

    // Extract HPI
    const hpiMatch = admissionNote.match(/(?:HPI|History of Present Illness|History|Present Illness)\s*:?\s*([\s\S]{50,500}?)(?=\n\n|\n[A-Z]|PMH|Past Medical|$)/i);
    if (hpiMatch) extracted.historyPresenting = hpiMatch[1].trim();

    // Extract PMH
    const pmhMatch = admissionNote.match(/(?:PMH|Past Medical History|Medical History)\s*:?\s*([\s\S]{20,300}?)(?=\n\n|\n[A-Z]|PSH|Medications|$)/i);
    if (pmhMatch) {
      extracted.pmh = pmhMatch[1].split(/[,\n]/)
        .filter(item => item.trim())
        .map(item => item.trim());
    }

    // Extract allergies
    const allergyMatch = admissionNote.match(/(?:Allergies|ALLERGIES|Allergy|NKDA)\s*:?\s*([^\n]+)/i);
    if (allergyMatch) {
      extracted.allergies = allergyMatch[1].trim();
    }

    // Extract procedures from progress notes
    if (progressNotes) {
      const procMatches = progressNotes.match(/(?:Procedure|Operation|Surgery)\s*:?\s*([^\n]+)/gi);
      if (procMatches) {
        extracted.procedures = procMatches.map(match => 
          match.replace(/(?:Procedure|Operation|Surgery)\s*:?\s*/i, '').trim()
        );
      }

      // Build hospital course from progress notes
      const courseMatches = progressNotes.match(/(?:POD|Post-op day|Hospital Day|HD)\s*#?\d+[^\n]*\n([\s\S]{50,500}?)(?=\n(?:POD|Post-op|Hospital Day|HD)|$)/gi);
      if (courseMatches) {
        extracted.hospitalCourse = courseMatches.join('\n\n');
      }
    }

    // Extract current exam from final note
    const examMatch = finalNote.match(/(?:Physical Exam|PE|Examination|Exam)\s*:?\s*([\s\S]{30,400}?)(?=\n\n|\n[A-Z]|Labs|Medications|$)/i);
    if (examMatch) extracted.currentExam = examMatch[1].trim();

    // Extract vital signs
    const vitalsMatch = finalNote.match(/(?:Vital Signs|Vitals|VS)\s*:?\s*([^\n]+)/i);
    if (vitalsMatch) extracted.vitalSigns = vitalsMatch[1].trim();

    // Extract discharge medications
    const medsMatch = finalNote.match(/(?:Discharge Medications|Medications|Meds)\s*:?\s*([\s\S]{30,500}?)(?=\n\n|\nFollow|Activity|Diet|$)/i);
    if (medsMatch) {
      extracted.dischargeMedications = medsMatch[1]
        .split(/\n/)
        .filter(med => med.trim() && /\d/.test(med))
        .map(med => med.trim());
    }

    // Extract disposition
    const dispositionMatch = finalNote.match(/(?:Disposition|Discharge to|Going to)\s*:?\s*([^\n]+)/i);
    if (dispositionMatch) extracted.disposition = dispositionMatch[1].trim();

    // Extract follow-up
    const followUpMatch = finalNote.match(/(?:Follow.?up|F\/U|Appointments)\s*:?\s*([\s\S]{20,300}?)(?=\n\n|Warning|Instructions|$)/i);
    if (followUpMatch) {
      extracted.followUp = followUpMatch[1]
        .split(/\n/)
        .filter(item => item.trim())
        .map(item => item.trim());
    }

    return extracted;
  }, [admissionNote, progressNotes, finalNote]);

  // AI extraction with Gemini
  const extractWithAI = useCallback(async () => {
    if (!apiKey) {
      throw new Error('API key is required for AI extraction');
    }

    const prompt = `Extract the following information from these clinical notes and return as JSON:
    - patientName, age, sex, mrn
    - admitDate, dischargeDate
    - admittingDiagnosis, dischargeDiagnosis
    - procedures (array), complications (array)
    - historyPresenting, hospitalCourse
    - currentExam, vitalSigns
    - dischargeMedications (array), allergies
    - pmh (array), psh (array)
    - disposition, diet, activity
    - followUp (array)

    ADMISSION NOTE:
    ${admissionNote}

    PROGRESS NOTES:
    ${progressNotes}

    DISCHARGE NOTE:
    ${finalNote}`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 2048,
            }
          })
        }
      );

      if (!response.ok) {
        throw new Error('AI extraction failed');
      }

      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (text) {
        // Try to parse JSON from the response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }
      
      throw new Error('Could not parse AI response');
    } catch (error) {
      console.error('AI extraction error:', error);
      throw error;
    }
  }, [apiKey, admissionNote, progressNotes, finalNote]);

  // Main extraction handler
  const handleExtractData = async () => {
    if (!admissionNote.trim() || !finalNote.trim()) {
      setError('Admission and discharge notes are required');
      return;
    }

    setLoading(true);
    setError('');
    setWarnings([]);
    setSuccess('');

    try {
      let extracted;
      
      if (useAI && apiKey) {
        try {
          extracted = await extractWithAI();
          setSuccess('AI extraction completed successfully');
        } catch (aiError) {
          console.warn('AI extraction failed, falling back to patterns:', aiError);
          extracted = extractWithPatterns();
          setWarnings(['AI extraction failed, used pattern matching instead']);
        }
      } else {
        extracted = extractWithPatterns();
        setSuccess('Pattern extraction completed');
      }

      // Validate extracted data
      const validationWarnings = [];
      if (!extracted.patientName) validationWarnings.push('Patient name not found');
      if (!extracted.dischargeDiagnosis) validationWarnings.push('Discharge diagnosis not found');
      if (!extracted.dischargeMedications?.length) validationWarnings.push('No discharge medications found');
      
      if (validationWarnings.length > 0) {
        setWarnings(prev => [...prev, ...validationWarnings]);
      }

      setExtractedData(extracted);
    } catch (err) {
      setError(`Extraction failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Generate summary from extracted data
  const generateSummary = () => {
    if (!extractedData) {
      setError('Please extract data first');
      return;
    }

    const formatList = (items, numbered = false) => {
      if (!items || items.length === 0) return 'None';
      return items.map((item, i) => 
        `${numbered ? `${i + 1}.` : '•'} ${item}`
      ).join('\n');
    };

    const templates = {
      standard: () => `DISCHARGE SUMMARY
================================================================================
Date: ${new Date().toLocaleDateString()}

PATIENT INFORMATION
Name: ${extractedData.patientName || '[Name]'}
Age/Sex: ${extractedData.age || '[Age]'} / ${extractedData.sex || '[Sex]'}
MRN: ${extractedData.mrn || '[MRN]'}
Admission Date: ${extractedData.admitDate || '[Admit Date]'}
Discharge Date: ${extractedData.dischargeDate || '[Discharge Date]'}

DIAGNOSES
Admitting Diagnosis: ${extractedData.admittingDiagnosis || '[Admitting Dx]'}
Discharge Diagnosis: ${extractedData.dischargeDiagnosis || '[Discharge Dx]'}

PROCEDURES PERFORMED
${formatList(extractedData.procedures, true)}

HISTORY OF PRESENT ILLNESS
${extractedData.historyPresenting || '[HPI]'}

HOSPITAL COURSE
${extractedData.hospitalCourse || '[Hospital course details]'}

PHYSICAL EXAMINATION AT DISCHARGE
Vital Signs: ${extractedData.vitalSigns || 'Stable'}
${extractedData.currentExam || '[Physical exam findings]'}

PAST MEDICAL HISTORY
${formatList(extractedData.pmh)}

PAST SURGICAL HISTORY
${formatList(extractedData.psh)}

ALLERGIES: ${extractedData.allergies || 'NKDA'}

DISCHARGE MEDICATIONS
${formatList(extractedData.dischargeMedications, true)}

DISCHARGE INSTRUCTIONS
Disposition: ${extractedData.disposition}
Diet: ${extractedData.diet}
Activity: ${extractedData.activity}

FOLLOW-UP APPOINTMENTS
${formatList(extractedData.followUp)}

If you have any questions or concerns, please contact your physician.

_______________________________
Physician Signature`,

      detailed: () => `COMPREHENSIVE DISCHARGE SUMMARY
================================================================================
[Detailed template with additional sections...]`,

      brief: () => `DISCHARGE SUMMARY - BRIEF
================================================================================
Patient: ${extractedData.patientName || '[Name]'} (${extractedData.age || '[Age]'}/${extractedData.sex || '[Sex]'})
Dates: ${extractedData.admitDate || '[Admit]'} to ${extractedData.dischargeDate || '[Discharge]'}

Diagnosis: ${extractedData.dischargeDiagnosis || '[Diagnosis]'}
Procedures: ${extractedData.procedures?.join(', ') || 'None'}

Medications:
${formatList(extractedData.dischargeMedications, true)}

Follow-up:
${formatList(extractedData.followUp)}

Disposition: ${extractedData.disposition}`
    };

    const template = templates[selectedTemplate] || templates.standard;
    const summary = template();
    
    setGeneratedSummary(summary);
    setSuccess('Summary generated successfully');
  };

  // File handling
  const handleFileUpload = (e, setter) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setter(event.target.result);
      setSuccess(`File uploaded: ${file.name}`);
    };
    reader.onerror = () => {
      setError('Failed to read file');
    };
    reader.readAsText(file);
  };

  // Copy to clipboard
  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(generatedSummary);
      setCopied(true);
      setSuccess('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError('Failed to copy to clipboard');
    }
  };

  // Download as file
  const downloadSummary = () => {
    const blob = new Blob([generatedSummary], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `discharge_summary_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setSuccess('Summary downloaded');
  };

  // Print summary
  const printSummary = () => {
    window.print();
  };

  // Clear all
  const clearAll = () => {
    if (!confirm('Clear all data? This cannot be undone.')) return;
    
    setAdmissionNote('');
    setProgressNotes('');
    setFinalNote('');
    setExtractedData(null);
    setGeneratedSummary('');
    setError('');
    setWarnings([]);
    setSuccess('All data cleared');
    localStorage.removeItem('dischargeSummaryDraft');
  };

  // Handle API key
  const handleApiKeySave = () => {
    if (apiKey) {
      localStorage.setItem('geminiApiKey', apiKey);
      setUseAI(true);
      setShowApiKeyInput(false);
      setSuccess('API key saved');
    }
  };

  // Update extracted data
  const updateExtractedData = (key, value) => {
    setExtractedData(prev => ({
      ...prev,
      [key]: value
    }));
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <header className="card mb-6 no-print">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Discharge Summary Generator
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Extract and generate medical discharge summaries
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {autoSave && (
              <span className="text-xs text-green-600 flex items-center">
                <Save className="h-3 w-3 mr-1" />
                Auto-save on
              </span>
            )}
            <button
              onClick={() => setAutoSave(!autoSave)}
              className="btn-secondary text-sm"
              title="Toggle auto-save"
            >
              <Database className="h-4 w-4" />
            </button>
            <button
              onClick={clearAll}
              className="btn-secondary text-sm text-red-600"
              title="Clear all data"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Notifications */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 no-print">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
      
      {warnings.length > 0 && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg no-print">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium mb-1">Warnings:</p>
              <ul className="list-disc list-inside space-y-1">
                {warnings.map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
      
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2 no-print animate-fade-in">
          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-800">{success}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Input */}
        <div className="space-y-6 no-print">
          {/* Settings */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Settings</h2>
              <Settings className="h-5 w-5 text-gray-400" />
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={useAI}
                    onChange={(e) => {
                      setUseAI(e.target.checked);
                      if (e.target.checked && !apiKey) {
                        setShowApiKeyInput(true);
                      }
                    }}
                    className="rounded"
                  />
                  <span className="text-sm font-medium">Use AI Extraction</span>
                  <Brain className="h-4 w-4 text-purple-600" />
                </label>
                {useAI && !apiKey && (
                  <button
                    onClick={() => setShowApiKeyInput(!showApiKeyInput)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Add API Key
                  </button>
                )}
              </div>
              
              {showApiKeyInput && (
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter Gemini API key"
                    className="input-field text-sm flex-1"
                  />
                  <button
                    onClick={handleApiKeySave}
                    className="btn-primary text-sm"
                  >
                    Save
                  </button>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium mb-1">Template</label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  className="input-field text-sm"
                >
                  <option value="standard">Standard</option>
                  <option value="detailed">Detailed</option>
                  <option value="brief">Brief</option>
                </select>
              </div>
            </div>
          </div>

          {/* Note Inputs */}
          <div className="card">
            <div className="border-b border-gray-200 -mx-6 -mt-6 mb-6">
              <nav className="flex">
                {[
                  { id: 'admission', label: 'Admission', icon: ClipboardList, required: true },
                  { id: 'progress', label: 'Progress', icon: Activity, required: false },
                  { id: 'final', label: 'Discharge', icon: Clock, required: true }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600 bg-blue-50'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <tab.icon className="h-4 w-4" />
                      {tab.label}
                      {tab.required && <span className="text-red-500">*</span>}
                    </div>
                  </button>
                ))}
              </nav>
            </div>

            <div className="relative">
              <textarea
                value={
                  activeTab === 'admission' ? admissionNote :
                  activeTab === 'progress' ? progressNotes :
                  finalNote
                }
                onChange={(e) => {
                  if (activeTab === 'admission') setAdmissionNote(e.target.value);
                  else if (activeTab === 'progress') setProgressNotes(e.target.value);
                  else setFinalNote(e.target.value);
                }}
                placeholder={`Paste ${activeTab} notes here...`}
                className="input-field h-64 font-mono text-sm resize-y"
              />
              
              <label className="absolute top-3 right-3 cursor-pointer">
                <div className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                  <Upload className="h-4 w-4 text-gray-600" />
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".txt,.md"
                  onChange={(e) => {
                    const setter = activeTab === 'admission' ? setAdmissionNote :
                                 activeTab === 'progress' ? setProgressNotes :
                                 setFinalNote;
                    handleFileUpload(e, setter);
                  }}
                />
              </label>
            </div>

            <div className="mt-4">
              <button
                onClick={handleExtractData}
                disabled={loading || !admissionNote.trim() || !finalNote.trim()}
                className="w-full btn-primary"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Extracting...</span>
                  </>
                ) : (
                  <>
                    {useAI ? <Brain className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
                    <span>Extract Information</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Extracted Data */}
          {extractedData && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Extracted Data</h3>
                <Edit className="h-5 w-5 text-gray-400" />
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {Object.entries(extractedData).map(([key, value]) => {
                  const isArray = Array.isArray(value);
                  const displayValue = isArray ? value.join('\n') : value || '';
                  
                  return (
                    <div key={key}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                      </label>
                      {isArray ? (
                        <textarea
                          value={displayValue}
                          onChange={(e) => updateExtractedData(key, e.target.value.split('\n').filter(Boolean))}
                          rows={Math.min(3, value.length || 1)}
                          className="input-field text-sm font-mono"
                        />
                      ) : (
                        <input
                          type="text"
                          value={displayValue}
                          onChange={(e) => updateExtractedData(key, e.target.value)}
                          className="input-field text-sm"
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                onClick={generateSummary}
                className="w-full btn-primary mt-4"
              >
                <FileText className="h-5 w-5" />
                <span>Generate Summary</span>
              </button>
            </div>
          )}
        </div>

        {/* Right Column - Output */}
        <div className="space-y-6">
          <div className="card">
            <div className="flex items-center justify-between mb-4 no-print">
              <h2 className="text-lg font-semibold text-gray-900">Generated Summary</h2>
              {generatedSummary && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={copySummary}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Copy"
                  >
                    {copied ? <CheckCircle className="h-5 w-5 text-green-600" /> : <Copy className="h-5 w-5" />}
                  </button>
                  <button
                    onClick={downloadSummary}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Download"
                  >
                    <Download className="h-5 w-5" />
                  </button>
                  <button
                    onClick={printSummary}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Print"
                  >
                    <Printer className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>

            {generatedSummary ? (
              <div 
                ref={summaryRef}
                className="bg-gray-50 rounded-lg p-4 max-h-[600px] overflow-auto"
              >
                <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800">
                  {generatedSummary}
                </pre>
              </div>
            ) : (
              <div className="flex items-center justify-center h-96 border-2 border-dashed border-gray-300 rounded-lg">
                <div className="text-center text-gray-400">
                  <FileText className="h-12 w-12 mx-auto mb-3" />
                  <p>Generated summary will appear here</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DischargeSummaryGenerator;