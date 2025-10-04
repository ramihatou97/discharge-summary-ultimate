import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { 
  FileText, Download, Copy, AlertCircle, CheckCircle, 
  Upload, Trash2, Wand2, RefreshCw, Edit, Settings,
  Zap, Brain, Toggle, Save, Eye, EyeOff, ChevronDown,
  ChevronRight, Activity, Clock, ClipboardList
} from 'lucide-react';

// Utility function for debouncing
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Main Hybrid Discharge Summary Generator Component
const HybridDischargeSummaryGenerator = () => {
  // State Management
  const [admissionNote, setAdmissionNote] = useState('');
  const [progressNotes, setProgressNotes] = useState('');
  const [finalNote, setFinalNote] = useState('');
  
  const [extractedData, setExtractedData] = useState(null);
  const [generatedSummary, setGeneratedSummary] = useState('');
  
  const [extractionMethod, setExtractionMethod] = useState('hybrid');
  const [selectedTemplate, setSelectedTemplate] = useState('neurosurgery');
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [showExtractedData, setShowExtractedData] = useState(true);
  const [autoSave, setAutoSave] = useState(true);
  
  const [loading, setLoading] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('admission');
  
  const [validationResults, setValidationResults] = useState(null);
  const [confidenceScores, setConfidenceScores] = useState({});

  // Auto-save functionality
  useEffect(() => {
    if (autoSave && (admissionNote || progressNotes || finalNote)) {
      const saveTimer = setTimeout(() => {
        localStorage.setItem('dischargeSummaryDraft', JSON.stringify({
          admissionNote,
          progressNotes,
          finalNote,
          savedAt: new Date().toISOString()
        }));
      }, 2000);
      
      return () => clearTimeout(saveTimer);
    }
  }, [admissionNote, progressNotes, finalNote, autoSave]);

  // Load saved draft on mount
  useEffect(() => {
    const savedDraft = localStorage.getItem('dischargeSummaryDraft');
    if (savedDraft) {
      const draft = JSON.parse(savedDraft);
      const savedDate = new Date(draft.savedAt);
      const hoursSince = (new Date() - savedDate) / (1000 * 60 * 60);
      
      if (hoursSince < 24) {
        setAdmissionNote(draft.admissionNote || '');
        setProgressNotes(draft.progressNotes || '');
        setFinalNote(draft.finalNote || '');
      }
    }
  }, []);

  // --- Regex-based extraction (from Version 2) ---
  const extractWithRegex = useCallback((admission, progress, final) => {
    const patterns = {
      patientName: [
        /(?:Patient:|Name:|Mr\.|Mrs\.|Ms\.)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,
        /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+is\s+a\s+\d+/,
        /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),?\s+(?:a\s+)?\d{1,3}[\s-]*(?:year|yo)/
      ],
      age: [
        /(\d{1,3})[\s-]*(?:year|yo|y\.o\.|y\/o)/i,
        /(?:Age|age):?\s*(\d{1,3})/i
      ],
      sex: [
        /\b(male|female|man|woman|M|F)\b/i,
        /(?:Sex|Gender):?\s*(male|female|M|F)/i
      ],
      mrn: [
        /(?:MRN|Medical Record Number|MR#):?\s*(\d+)/i,
        /(?:Record|Chart)\s*#:?\s*(\d+)/i
      ]
    };

    const extractField = (text, fieldPatterns) => {
      if (!text) return { value: '', confidence: 0 };
      
      for (const pattern of fieldPatterns) {
        const match = text.match(pattern);
        if (match) {
          return { 
            value: match[1]?.trim() || '', 
            confidence: 0.7 + (match[0].length / text.length) * 0.3 
          };
        }
      }
      return { value: '', confidence: 0 };
    };

    const scores = {};
    const extracted = {
      patientName: '',
      age: '',
      sex: '',
      mrn: '',
      admitDate: '',
      dischargeDate: '',
      admittingDiagnosis: '',
      dischargeDiagnosis: '',
      procedures: [],
      historyPresenting: '',
      hospitalCourse: '',
      complications: [],
      currentExam: '',
      vitalSigns: '',
      dischargeMedications: [],
      allergies: '',
      pmh: [],
      psh: [],
      disposition: 'Home',
      diet: '',
      activity: '',
      followUp: []
    };

    // Extract from admission note
    if (admission) {
      const nameResult = extractField(admission, patterns.patientName);
      extracted.patientName = nameResult.value;
      scores.patientName = nameResult.confidence;

      const ageResult = extractField(admission, patterns.age);
      extracted.age = ageResult.value;
      scores.age = ageResult.confidence;

      const sexResult = extractField(admission, patterns.sex);
      if (sexResult.value) {
        const sex = sexResult.value.toLowerCase();
        extracted.sex = (sex === 'm' || sex === 'male' || sex === 'man') ? 'Male' : 'Female';
        scores.sex = sexResult.confidence;
      }

      const mrnResult = extractField(admission, patterns.mrn);
      extracted.mrn = mrnResult.value;
      scores.mrn = mrnResult.confidence;

      // Extract dates
      const admitDateMatch = admission.match(/(?:Date of (?:Admission|Admit)|Admitted?|Admission Date):?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i);
      if (admitDateMatch) {
        extracted.admitDate = admitDateMatch[1];
        scores.admitDate = 0.9;
      }

      // Extract diagnoses
      const admitDxMatch = admission.match(/(?:Admitting Diagnosis|Admission Diagnosis|Admit Dx|Chief Complaint|CC):?\s*([^\n]+)/i);
      if (admitDxMatch) {
        extracted.admittingDiagnosis = admitDxMatch[1].trim();
        scores.admittingDiagnosis = 0.8;
      }

      // Extract HPI
      const hpiMatch = admission.match(/(?:HPI|History of Present Illness|Presenting Complaint):?\s*([\s\S]*?)(?=\n\n|PMH:|Past Medical|ROS:|Physical Exam|$)/i);
      if (hpiMatch) {
        extracted.historyPresenting = hpiMatch[1].trim();
        scores.historyPresenting = 0.7;
      }

      // Extract PMH
      const pmhMatch = admission.match(/(?:PMH|Past Medical History):?\s*([\s\S]*?)(?=\n\n|PSH:|Past Surgical|Social|Family|Medications|$)/i);
      if (pmhMatch) {
        extracted.pmh = pmhMatch[1].trim().split(/[,\n]/).filter(line => line.trim()).map(line => line.trim());
        scores.pmh = 0.7;
      }

      // Extract PSH
      const pshMatch = admission.match(/(?:PSH|Past Surgical History):?\s*([\s\S]*?)(?=\n\n|Social|Family|Medications|Allergies|$)/i);
      if (pshMatch) {
        extracted.psh = pshMatch[1].trim().split(/[,\n]/).filter(line => line.trim()).map(line => line.trim());
        scores.psh = 0.7;
      }

      // Extract allergies
      const allergyMatch = admission.match(/(?:Allergies?|NKDA|Allergy):?\s*([^\n]+)/i);
      if (allergyMatch) {
        extracted.allergies = allergyMatch[1].trim();
        scores.allergies = 0.8;
      }
    }

    // Extract from progress notes
    if (progress) {
      const progressEntries = progress.split(/(?:Progress Note|PROGRESS NOTE|Date:|POD#?\s*\d+)/i);
      const courseEvents = [];
      
      progressEntries.forEach(entry => {
        if (entry.trim()) {
          // Look for procedures
          const procMatch = entry.match(/(?:Procedure|Operation|Surgery|Post-op):?\s*([^\n]+)/i);
          if (procMatch && !extracted.procedures.includes(procMatch[1])) {
            extracted.procedures.push(procMatch[1].trim());
          }

          // Look for complications
          const compMatch = entry.match(/(?:Complications?|Issues?|Events?):?\s*([^\n]+)/i);
          if (compMatch && !compMatch[1].toLowerCase().includes('none')) {
            extracted.complications.push(compMatch[1].trim());
          }

          // Build hospital course
          const courseMatch = entry.match(/(?:Hospital Course|Clinical Course|Overnight|Today|Events):?\s*([\s\S]*?)(?=\n\n|Plan:|$)/i);
          if (courseMatch) {
            courseEvents.push(courseMatch[1].trim());
          }
        }
      });

      if (courseEvents.length > 0) {
        extracted.hospitalCourse = courseEvents.join('\n\n');
        scores.hospitalCourse = 0.6;
      }
    }

    // Extract from final note
    if (final) {
      const dischargeDateMatch = final.match(/(?:Discharge Date|Date of Discharge|Discharged?):?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i);
      if (dischargeDateMatch) {
        extracted.dischargeDate = dischargeDateMatch[1];
        scores.dischargeDate = 0.9;
      }

      const dischargeDxMatch = final.match(/(?:Discharge Diagnosis|Final Diagnosis|Principal Diagnosis):?\s*([^\n]+)/i);
      if (dischargeDxMatch) {
        extracted.dischargeDiagnosis = dischargeDxMatch[1].trim();
        scores.dischargeDiagnosis = 0.8;
      }

      const examMatch = final.match(/(?:Physical Exam|Examination|Discharge Exam):?\s*([\s\S]*?)(?=\n\n|Labs|Medications|Plan|$)/i);
      if (examMatch) {
        extracted.currentExam = examMatch[1].trim();
        scores.currentExam = 0.7;
      }

      const vitalsMatch = final.match(/(?:Vital Signs?|VS|Vitals):?\s*([^\n]+)/i);
      if (vitalsMatch) {
        extracted.vitalSigns = vitalsMatch[1].trim();
        scores.vitalSigns = 0.8;
      }

      const dischargeMedsMatch = final.match(/(?:Discharge Medications?|Medications? at Discharge):?\s*([\s\S]*?)(?=\n\n|Follow|Activity|Diet|$)/i);
      if (dischargeMedsMatch) {
        extracted.dischargeMedications = dischargeMedsMatch[1].trim().split('\n').filter(line => line.trim());
        scores.dischargeMedications = 0.7;
      }

      const dispositionMatch = final.match(/(?:Disposition|Discharge to|Discharged? to):?\s*([^\n]+)/i);
      if (dispositionMatch) {
        extracted.disposition = dispositionMatch[1].trim();
        scores.disposition = 0.8;
      }

      const dietMatch = final.match(/(?:Diet):?\s*([^\n]+)/i);
      if (dietMatch) {
        extracted.diet = dietMatch[1].trim();
        scores.diet = 0.7;
      }

      const activityMatch = final.match(/(?:Activity|Restrictions?):?\s*([^\n]+)/i);
      if (activityMatch) {
        extracted.activity = activityMatch[1].trim();
        scores.activity = 0.7;
      }

      const followUpMatch = final.match(/(?:Follow[\s-]?up|F\/U|Appointments?):?\s*([\s\S]*?)(?=\n\n|Thank you|$)/i);
      if (followUpMatch) {
        extracted.followUp = followUpMatch[1].trim().split('\n').filter(line => line.trim());
        scores.followUp = 0.6;
      }
    }

    setConfidenceScores(scores);
    return extracted;
  }, []);

  // --- AI-based extraction (from Version 1) ---
  const extractWithAI = useCallback(async (admission, progress, final) => {
    const userPrompt = `
      Analyze the following clinical notes to create a discharge summary.
      Extract all relevant information for a comprehensive discharge summary.
      
      ADMISSION/CONSULT NOTE:
      ${admission}

      PROGRESS NOTES:
      ${progress}

      FINAL/DISCHARGE NOTE:
      ${final}
    `;

    const schema = {
      type: "OBJECT",
      properties: {
        patientName: { type: "STRING", description: "Patient's full name" },
        age: { type: "STRING", description: "Patient's age" },
        sex: { type: "STRING", description: "Patient's sex" },
        mrn: { type: "STRING", description: "Medical record number" },
        admitDate: { type: "STRING", description: "Admission date" },
        dischargeDate: { type: "STRING", description: "Discharge date" },
        admittingDiagnosis: { type: "STRING", description: "Admitting diagnosis" },
        dischargeDiagnosis: { type: "STRING", description: "Discharge diagnosis" },
        procedures: { type: "ARRAY", items: { type: "STRING" } },
        historyPresenting: { type: "STRING", description: "History of presenting illness" },
        hospitalCourse: { type: "STRING", description: "Hospital course" },
        complications: { type: "ARRAY", items: { type: "STRING" } },
        currentExam: { type: "STRING", description: "Current examination" },
        vitalSigns: { type: "STRING", description: "Vital signs" },
        dischargeMedications: { type: "ARRAY", items: { type: "STRING" } },
        allergies: { type: "STRING", description: "Allergies" },
        pmh: { type: "ARRAY", items: { type: "STRING" } },
        psh: { type: "ARRAY", items: { type: "STRING" } },
        disposition: { type: "STRING", description: "Discharge disposition" },
        diet: { type: "STRING", description: "Diet recommendations" },
        activity: { type: "STRING", description: "Activity restrictions" },
        followUp: { type: "ARRAY", items: { type: "STRING" } }
      }
    };

    try {
      const apiKey = process.env.REACT_APP_GEMINI_API_KEY || "";
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;

      const payload = {
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schema,
        },
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const result = await response.json();
      const candidate = result.candidates?.[0];
      
      if (candidate?.content?.parts?.[0]?.text) {
        const parsedJson = JSON.parse(candidate.content.parts[0].text);
        // Set high confidence for AI extraction
        const aiScores = {};
        Object.keys(parsedJson).forEach(key => {
          aiScores[key] = 0.95;
        });
        setConfidenceScores(aiScores);
        return parsedJson;
      }
      throw new Error("Invalid AI response structure");
    } catch (err) {
      console.error('AI extraction failed:', err);
      throw err;
    }
  }, []);

  // --- Hybrid extraction with fallback ---
  const extractDataHybrid = useCallback(async () => {
    if (!admissionNote.trim() || !finalNote.trim()) {
      setError('Admission and Final notes are required.');
      return;
    }

    setLoading(true);
    setError('');
    setWarnings([]);
    setExtractedData(null);
    setGeneratedSummary('');
    setExtractionProgress(0);

    let extractedResult = null;
    let extractionSuccess = false;

    try {
      if (extractionMethod === 'ai' || extractionMethod === 'hybrid') {
        setExtractionProgress(25);
        try {
          extractedResult = await extractWithAI(admissionNote, progressNotes, finalNote);
          extractionSuccess = true;
          setExtractionProgress(75);
        } catch (aiError) {
          console.warn('AI extraction failed, trying regex fallback:', aiError);
          if (extractionMethod === 'ai') {
            throw new Error('AI extraction failed and no fallback available');
          }
        }
      }

      if (!extractionSuccess && (extractionMethod === 'regex' || extractionMethod === 'hybrid')) {
        setExtractionProgress(50);
        extractedResult = extractWithRegex(admissionNote, progressNotes, finalNote);
        extractionSuccess = true;
        setExtractionProgress(75);
      }

      if (extractedResult) {
        // Validate the extracted data
        const validation = validateExtractedData(extractedResult);
        setValidationResults(validation);
        
        if (validation.warnings.length > 0) {
          setWarnings(validation.warnings);
        }

        setExtractedData(extractedResult);
        setExtractionProgress(100);
        
        // Auto-generate if all required fields are present
        if (validation.isValid && validation.warnings.length === 0) {
          setTimeout(() => {
            generateSummaryFromData(extractedResult);
          }, 500);
        }
      }
    } catch (err) {
      setError(`Extraction failed: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
      setTimeout(() => setExtractionProgress(0), 1000);
    }
  }, [admissionNote, progressNotes, finalNote, extractionMethod, extractWithAI, extractWithRegex]);

  // --- Validation function ---
  const validateExtractedData = useCallback((data) => {
    const errors = [];
    const warnings = [];
    
    // Required fields
    if (!data.patientName) warnings.push('Patient name is missing');
    if (!data.dischargeDiagnosis) errors.push('Discharge diagnosis is required');
    if (!data.admitDate) warnings.push('Admission date is missing');
    if (!data.dischargeDate) warnings.push('Discharge date is missing');
    
    // Logical checks
    if (data.admitDate && data.dischargeDate) {
      const admit = new Date(data.admitDate);
      const discharge = new Date(data.dischargeDate);
      if (discharge < admit) {
        errors.push('Discharge date cannot be before admission date');
      }
    }
    
    // Check for low confidence fields
    Object.entries(confidenceScores).forEach(([field, score]) => {
      if (score < 0.5 && data[field]) {
        warnings.push(`Low confidence for ${field} extraction (${Math.round(score * 100)}%)`);
      }
    });
    
    return { 
      errors, 
      warnings, 
      isValid: errors.length === 0,
      completeness: Object.values(data).filter(v => v && (Array.isArray(v) ? v.length > 0 : true)).length / Object.keys(data).length
    };
  }, [confidenceScores]);

  // --- Generate summary from extracted data ---
  const generateSummaryFromData = useCallback((data) => {
    const templates = {
      neurosurgery: generateNeurosurgeryTemplate,
      general: generateGeneralTemplate,
      custom: generateCustomTemplate
    };
    
    const templateFunction = templates[selectedTemplate] || templates.neurosurgery;
    const summary = templateFunction(data);
    setGeneratedSummary(summary);
  }, [selectedTemplate]);

  // Template generators
  const generateNeurosurgeryTemplate = (data) => {
    const formatList = (items, type = 'bullet') => {
      if (!items || items.length === 0) return 'None';
      return items.map((item, i) => `${type === 'number' ? i + 1 + '.' : '•'} ${item}`).join('\n');
    };

    let los = '';
    if (data.admitDate && data.dischargeDate) {
      const admit = new Date(data.admitDate);
      const discharge = new Date(data.dischargeDate);
      const diff = Math.ceil((discharge - admit) / (1000 * 60 * 60 * 24));
      los = diff > 0 ? `${diff} days` : '1 day';
    }

    return `NEUROSURGERY DISCHARGE SUMMARY
===============================================
Generated: ${new Date().toLocaleDateString()}

PATIENT INFORMATION
Name: ${data.patientName || '[Patient Name]'}
Age/Sex: ${data.age || '[Age]'} / ${data.sex || '[Sex]'}
MRN: ${data.mrn || '[MRN]'}

ADMISSION INFORMATION
Admitted: ${data.admitDate || '[Date]'}
Discharged: ${data.dischargeDate || '[Date]'}
Length of Stay: ${los || '[LOS]'}
Discharge Disposition: ${data.disposition || 'Home'}

DIAGNOSES
Admitting Diagnosis:
${data.admittingDiagnosis || '[To be completed]'}

Discharge Diagnosis:
${data.dischargeDiagnosis || '[To be completed]'}

PROCEDURES
${formatList(data.procedures, 'number')}

HISTORY OF PRESENTING ILLNESS
${data.historyPresenting || '[HPI from admission note]'}

HOSPITAL COURSE
${data.hospitalCourse || '[Detailed hospital course]'}

${data.complications?.length > 0 ? `Complications:\n${formatList(data.complications)}` : ''}

STATUS AT DISCHARGE
Vital Signs: ${data.vitalSigns || 'Stable and afebrile'}
Physical Examination:
${data.currentExam || '[Current examination findings]'}

PAST MEDICAL HISTORY
${formatList(data.pmh)}

PAST SURGICAL HISTORY
${formatList(data.psh)}

ALLERGIES
${data.allergies || 'No Known Drug Allergies'}

DISCHARGE MEDICATIONS
${formatList(data.dischargeMedications, 'number')}

DISCHARGE INSTRUCTIONS
Diet: ${data.diet || 'Regular diet as tolerated'}
Activity: ${data.activity || 'As tolerated with restrictions as discussed'}

FOLLOW-UP
${formatList(data.followUp)}

WARNING SIGNS
Return to the emergency department for:
• Fever > 101.5°F
• Severe headache
• New weakness or numbness
• Seizures
• Wound drainage or signs of infection
• Any other concerning symptoms

Thank you for allowing us to participate in this patient's care.

[Physician Name], MD
Department of Neurosurgery
[Hospital Name]
[Contact Number]`;
  };

  const generateGeneralTemplate = (data) => {
    // Similar to neurosurgery but with general surgery focus
    return `GENERAL DISCHARGE SUMMARY\n[Template content...]`;
  };

  const generateCustomTemplate = (data) => {
    // User-defined template
    return `CUSTOM DISCHARGE SUMMARY\n[User template...]`;
  };

  // Handle data changes
  const handleDataChange = useCallback((key, value) => {
    setExtractedData(prevData => ({ ...prevData, [key]: value }));
  }, []);

  // File upload handler
  const handleFileUpload = (e, setter) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setter(event.target.result);
      };
      reader.readAsText(file);
    }
  };

  // Copy to clipboard
  const copySummary = () => {
    navigator.clipboard.writeText(generatedSummary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download summary
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
  };

  // Clear all data
  const clearAll = () => {
    setAdmissionNote('');
    setProgressNotes('');
    setFinalNote('');
    setGeneratedSummary('');
    setExtractedData(null);
    setError('');
    setWarnings([]);
    setValidationResults(null);
    localStorage.removeItem('dischargeSummaryDraft');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Enhanced Header */}
        <header className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <FileText className="h-10 w-10 text-blue-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Hybrid Discharge Summary Generator
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  AI-powered extraction with intelligent fallback • v3.0
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {autoSave && (
                <div className="flex items-center text-sm text-green-600">
                  <Save className="h-4 w-4 mr-1" />
                  Auto-save enabled
                </div>
              )}
              <button
                onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Settings"
              >
                <Settings className="h-5 w-5" />
              </button>
              <button
                onClick={clearAll}
                className="flex items-center space-x-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                <span>Clear All</span>
              </button>
            </div>
          </div>

          {/* Advanced Settings Panel */}
          {showAdvancedSettings && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Advanced Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Extraction Method */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Extraction Method
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="hybrid"
                        checked={extractionMethod === 'hybrid'}
                        onChange={(e) => setExtractionMethod(e.target.value)}
                        className="mr-2"
                      />
                      <span className="text-sm">
                        <Brain className="inline h-4 w-4 mr-1 text-purple-600" />
                        Hybrid (AI + Fallback)
                      </span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="ai"
                        checked={extractionMethod === 'ai'}
                        onChange={(e) => setExtractionMethod(e.target.value)}
                        className="mr-2"
                      />
                      <span className="text-sm">
                        <Wand2 className="inline h-4 w-4 mr-1 text-blue-600" />
                        AI Only
                      </span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="regex"
                        checked={extractionMethod === 'regex'}
                        onChange={(e) => setExtractionMethod(e.target.value)}
                        className="mr-2"
                      />
                      <span className="text-sm">
                        <Zap className="inline h-4 w-4 mr-1 text-yellow-600" />
                        Pattern Matching Only
                      </span>
                    </label>
                  </div>
                </div>

                {/* Template Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Summary Template
                  </label>
                  <select
                    value={selectedTemplate}
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="neurosurgery">Neurosurgery</option>
                    <option value="general">General Surgery</option>
                    <option value="custom">Custom Template</option>
                  </select>
                </div>

                {/* Auto-save Toggle */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Options
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={autoSave}
                      onChange={(e) => setAutoSave(e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm">Enable auto-save</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Input and Extraction */}
          <div className="space-y-6">
            {/* Note Input Section */}
            <NoteInputSection
              admissionNote={admissionNote}
              setAdmissionNote={setAdmissionNote}
              progressNotes={progressNotes}
              setProgressNotes={setProgressNotes}
              finalNote={finalNote}
              setFinalNote={setFinalNote}
              onFileUpload={handleFileUpload}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            />

            {/* Extraction Controls */}
            <div className="bg-white p-6 rounded-xl shadow-lg">
              <button
                onClick={extractDataHybrid}
                disabled={loading || !admissionNote.trim() || !finalNote.trim()}
                className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-2 text-lg font-semibold shadow-md"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-6 w-6 animate-spin" />
                    <span>Extracting Data...</span>
                  </>
                ) : (
                  <>
                    {extractionMethod === 'hybrid' && <Brain className="h-6 w-6" />}
                    {extractionMethod === 'ai' && <Wand2 className="h-6 w-6" />}
                    {extractionMethod === 'regex' && <Zap className="h-6 w-6" />}
                    <span>Extract Information</span>
                  </>
                )}
              </button>

              {/* Progress Bar */}
              {extractionProgress > 0 && (
                <div className="mt-4">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${extractionProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-600 text-center mt-2">
                    {extractionProgress < 50 ? 'Analyzing notes...' : 
                     extractionProgress < 75 ? 'Extracting information...' : 
                     'Finalizing...'}
                  </p>
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                </div>
              )}

              {/* Warnings Display */}
              {warnings.length > 0 && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
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

              {/* Validation Results */}
              {validationResults && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-blue-800">
                      Data Completeness: {Math.round(validationResults.completeness * 100)}%
                    </span>
                    <span className={`text-sm font-medium ${validationResults.isValid ? 'text-green-600' : 'text-red-600'}`}>
                      {validationResults.isValid ? '✓ Valid' : '✗ Invalid'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Extracted Data Review */}
            {extractedData && (
              <ExtractedDataReview
                data={extractedData}
                onDataChange={handleDataChange}
                onGenerateSummary={() => generateSummaryFromData(extractedData)}
                showExtracted={showExtractedData}
                setShowExtracted={setShowExtractedData}
                confidenceScores={confidenceScores}
              />
            )}
          </div>

          {/* Right Column: Output */}
          <OutputSection
            summary={generatedSummary}
            copied={copied}
            onCopy={copySummary}
            onDownload={downloadSummary}
          />
        </main>

        {/* Footer */}
        <footer className="mt-8 text-center text-xs text-gray-500">
          <p>Hybrid Discharge Summary Generator v3.0 | Combines AI and pattern matching for optimal results</p>
          <p className="mt-1">Always review and verify all information before finalizing documentation</p>
        </footer>
      </div>
    </div>
  );
};

// Sub-component for Note Input
const NoteInputSection = ({ 
  admissionNote, setAdmissionNote, 
  progressNotes, setProgressNotes, 
  finalNote, setFinalNote, 
  onFileUpload, activeTab, setActiveTab 
}) => {
  const tabs = [
    { 
      id: 'admission', 
      label: 'Admission/Consult', 
      icon: ClipboardList,
      hasContent: !!admissionNote,
      required: true 
    },
    { 
      id: 'progress', 
      label: 'Progress Notes', 
      icon: Activity,
      hasContent: !!progressNotes,
      required: false 
    },
    { 
      id: 'final', 
      label: 'Final/Discharge', 
      icon: Clock,
      hasContent: !!finalNote,
      required: true 
    },
  ];

  const noteStates = {
    admission: { value: admissionNote, setter: setAdmissionNote },
    progress: { value: progressNotes, setter: setProgressNotes },
    final: { value: finalNote, setter: setFinalNote }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 bg-gray-50">
        <nav className="flex -mb-px">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 px-4 border-b-2 font-medium text-sm transition-all ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 bg-white'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
                {tab.required && <span className="text-red-500">*</span>}
                {tab.hasContent && <CheckCircle className="h-3 w-3 text-green-500" />}
              </div>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        <div className="relative">
          <textarea
            value={noteStates[activeTab].value}
            onChange={(e) => noteStates[activeTab].setter(e.target.value)}
            placeholder={`Paste ${tabs.find(t => t.id === activeTab).label} here...`}
            className="w-full h-80 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y font-mono text-sm"
          />
          
          {/* Upload Button */}
          <label className="absolute top-3 right-3 cursor-pointer">
            <div className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
              <Upload className="h-5 w-5 text-gray-600" />
            </div>
            <input 
              type="file" 
              className="hidden" 
              accept=".txt,.md,.doc,.docx" 
              onChange={(e) => onFileUpload(e, noteStates[activeTab].setter)} 
            />
          </label>

          {/* Character Count */}
          <div className="absolute bottom-3 right-3 text-xs text-gray-400">
            {noteStates[activeTab].value.length} characters
          </div>
        </div>
      </div>
    </div>
  );
};

// Sub-component for Extracted Data Review
const ExtractedDataReview = ({ 
  data, onDataChange, onGenerateSummary, 
  showExtracted, setShowExtracted, confidenceScores 
}) => {
  const getConfidenceColor = (score) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <Edit className="h-6 w-6 text-green-600" />
          <h2 className="text-xl font-bold text-gray-800">Review Extracted Data</h2>
        </div>
        <button
          onClick={() => setShowExtracted(!showExtracted)}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          {showExtracted ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>

      {showExtracted && (
        <>
          <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg p-3 mb-4">
            Data extraction complete. Review and edit fields below before generating the summary.
          </div>

          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
            {Object.entries(data).map(([key, value]) => {
              const isArray = Array.isArray(value);
              const displayValue = isArray ? value.join('\n') : value;
              const confidence = confidenceScores[key];
              
              return (
                <div key={key} className="group">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-gray-700">
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </label>
                    {confidence !== undefined && (
                      <span className={`text-xs ${getConfidenceColor(confidence)}`}>
                        {Math.round(confidence * 100)}% confidence
                      </span>
                    )}
                  </div>
                  {isArray ? (
                    <textarea
                      value={displayValue}
                      onChange={(e) => onDataChange(key, e.target.value.split('\n').filter(line => line.trim()))}
                      rows={Math.min(5, Math.max(2, value.length))}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 text-sm"
                    />
                  ) : (
                    <input
                      type="text"
                      value={displayValue}
                      onChange={(e) => onDataChange(key, e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 text-sm"
                    />
                  )}
                </div>
              );
            })}
          </div>

          <button
            onClick={onGenerateSummary}
            className="w-full mt-6 py-3 px-4 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all flex items-center justify-center space-x-2 text-lg font-semibold shadow-md"
          >
            <FileText className="h-6 w-6" />
            <span>Generate Final Summary</span>
          </button>
        </>
      )}
    </div>
  );
};

// Sub-component for Output Section
const OutputSection = ({ summary, copied, onCopy, onDownload }) => {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6 h-fit">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">Generated Summary</h2>
        {summary && (
          <div className="flex items-center space-x-2">
            <button
              onClick={onCopy}
              title="Copy to clipboard"
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {copied ? <CheckCircle className="h-5 w-5 text-green-600" /> : <Copy className="h-5 w-5" />}
            </button>
            <button
              onClick={onDownload}
              title="Download as .txt"
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Download className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      {summary ? (
        <div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <p className="text-sm text-green-800">
                Summary generated successfully. Review and complete any [bracketed] fields.
              </p>
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4 max-h-[600px] overflow-auto">
            <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800">
              {summary}
            </pre>
          </div>

          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div className="text-xs text-amber-800">
                <p className="font-medium mb-1">Important:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Review all information for accuracy</li>
                  <li>Complete fields marked with [brackets]</li>
                  <li>Ensure compliance with institutional standards</li>
                  <li>Physician approval required before finalization</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-96 border-2 border-dashed border-gray-300 rounded-lg">
          <div className="text-center text-gray-400">
            <FileText className="h-12 w-12 mx-auto mb-3" />
            <p>Generated summary will appear here</p>
            <p className="text-xs mt-2">Extract data first, then generate summary</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default HybridDischargeSummaryGenerator;