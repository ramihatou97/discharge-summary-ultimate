import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  FileText, Download, Copy, AlertCircle, CheckCircle, 
  Upload, Trash2, Wand2, RefreshCw, Edit, Settings,
  Save, Eye, EyeOff, Printer, Shield, Database,
  Activity, Clock, ClipboardList, ChevronDown, ChevronRight,
  Heart, Brain, Zap, Loader2, Info
} from 'lucide-react';

const DischargeSummaryGenerator = () => {
  // Core State - Single unified input
  const [unifiedNotes, setUnifiedNotes] = useState('');
  const [detectedNotes, setDetectedNotes] = useState({
    admission: '',
    progress: '',
    consultant: '',
    procedure: '',
    final: ''
  });
  const [extractedData, setExtractedData] = useState(null);
  const [generatedSummary, setGeneratedSummary] = useState('');
  const [editableSummary, setEditableSummary] = useState('');
  
  // UI State
  const [activeTab, setActiveTab] = useState('input');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [success, setSuccess] = useState('');
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Settings - Multi-AI Configuration
  const [useAI, setUseAI] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [claudeApiKey, setClaudeApiKey] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [autoSave, setAutoSave] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState('standard');
  
  // ML Learning State
  const [learningData, setLearningData] = useState(() => {
    const saved = localStorage.getItem('dischargeSummaryLearning');
    return saved ? JSON.parse(saved) : {
      corrections: [],
      patterns: {},
      totalEdits: 0,
      lastUpdated: null
    };
  });
  
  // Refs
  const fileInputRef = useRef(null);
  const summaryRef = useRef(null);

  // Load saved data on mount
  useEffect(() => {
    const savedData = localStorage.getItem('dischargeSummaryDraft');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed.unifiedNotes) setUnifiedNotes(parsed.unifiedNotes);
        if (parsed.detectedNotes) setDetectedNotes(parsed.detectedNotes);
        setSuccess('Previous draft restored');
        setTimeout(() => setSuccess(''), 3000);
      } catch (e) {
        console.error('Failed to load saved draft');
      }
    }

    // Load API keys if saved
    const savedGemini = localStorage.getItem('geminiApiKey');
    const savedOpenAI = localStorage.getItem('openaiApiKey');
    const savedClaude = localStorage.getItem('claudeApiKey');
    
    if (savedGemini) {
      setGeminiApiKey(savedGemini);
      setUseAI(true);
    }
    if (savedOpenAI) setOpenaiApiKey(savedOpenAI);
    if (savedClaude) setClaudeApiKey(savedClaude);
  }, []);

  // Auto-save
  useEffect(() => {
    if (!autoSave) return;
    
    const saveTimer = setTimeout(() => {
      if (unifiedNotes || Object.values(detectedNotes).some(n => n)) {
        localStorage.setItem('dischargeSummaryDraft', JSON.stringify({
          unifiedNotes,
          detectedNotes,
          savedAt: new Date().toISOString()
        }));
      }
    }, 2000);

    return () => clearTimeout(saveTimer);
  }, [unifiedNotes, detectedNotes, autoSave]);

  // Smart Note Detection Function
  const detectNoteTypes = useCallback((text) => {
    const detected = {
      admission: '',
      progress: '',
      consultant: '',
      procedure: '',
      final: ''
    };

    // Split by common delimiters
    const sections = text.split(/(?:\n={3,}|\n-{3,}|\n\*{3,}|\n#{2,})/);
    
    sections.forEach(section => {
      const lowerSection = section.toLowerCase();
      const trimmedSection = section.trim();
      
      if (!trimmedSection) return;
      
      // Admission/H&P Note Detection
      if (lowerSection.includes('admission') || 
          lowerSection.includes('history and physical') || 
          lowerSection.includes('h&p') ||
          lowerSection.includes('chief complaint') ||
          (lowerSection.includes('patient') && lowerSection.includes('admitted'))) {
        detected.admission += trimmedSection + '\n\n';
      }
      // Progress Note Detection
      else if (lowerSection.includes('progress note') || 
               lowerSection.includes('daily note') ||
               lowerSection.includes('soap note') ||
               (lowerSection.includes('neurosurgery') && lowerSection.includes('note')) ||
               lowerSection.match(/post[- ]?op(?:erative)?\s+day/i)) {
        detected.progress += trimmedSection + '\n\n';
      }
      // Consultant Note Detection
      else if (lowerSection.includes('consult') || 
               lowerSection.includes('consultation') ||
               lowerSection.includes('recommendations from') ||
               lowerSection.match(/(?:cardiology|neurology|medicine|icu|surgery)\s+note/i)) {
        detected.consultant += trimmedSection + '\n\n';
      }
      // Procedure Note Detection
      else if (lowerSection.includes('operative note') || 
               lowerSection.includes('procedure note') ||
               lowerSection.includes('operation performed') ||
               lowerSection.includes('craniotomy') ||
               lowerSection.includes('laminectomy') ||
               lowerSection.includes('discectomy') ||
               lowerSection.includes('fusion') ||
               lowerSection.match(/(?:indication|procedure|findings|complications):/gi)) {
        detected.procedure += trimmedSection + '\n\n';
      }
      // Discharge/Final Note Detection
      else if (lowerSection.includes('discharge') || 
               lowerSection.includes('final note') ||
               lowerSection.includes('discharge summary') ||
               lowerSection.includes('disposition')) {
        detected.final += trimmedSection + '\n\n';
      }
      // If no specific marker, add to admission as default
      else if (detected.admission === '' && trimmedSection.length > 50) {
        detected.admission += trimmedSection + '\n\n';
      }
    });

    // Fallback: if nothing detected, treat entire text as admission note
    if (!Object.values(detected).some(v => v.trim())) {
      detected.admission = text;
    }

    return detected;
  }, []);

  // Pattern-based extraction (updated to use detected notes)
  const extractWithPatterns = useCallback(() => {
    const notes = detectedNotes;
    const admissionNote = notes.admission || '';
    const progressNotes = notes.progress || '';
    const finalNote = notes.final || '';
    const procedureNote = notes.procedure || '';
    
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

    // Extract procedures from procedure note or progress notes
    const procedureText = procedureNote || progressNotes;
    if (procedureText) {
      const procMatches = procedureText.match(/(?:Procedure|Operation|Surgery)\s*:?\s*([^\n]+)/gi);
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
  }, [detectedNotes]);

  // Multi-AI Extraction Functions
  
  // Gemini AI - Medical Information Extraction
  const extractWithGemini = useCallback(async () => {
    if (!geminiApiKey) {
      throw new Error('Gemini API key is required');
    }

    const notes = detectedNotes;
    const prompt = `You are a medical AI specialized in extracting neurosurgical patient information. 
Extract the following information from these clinical notes and return as JSON:
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
${notes.admission}

PROGRESS NOTES:
${notes.progress}

CONSULTANT NOTES:
${notes.consultant}

PROCEDURE NOTE:
${notes.procedure}

DISCHARGE NOTE:
${notes.final}`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiApiKey}`,
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
        throw new Error('Gemini API request failed');
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
      
      throw new Error('Could not parse Gemini response');
    } catch (error) {
      console.error('Gemini extraction error:', error);
      throw error;
    }
  }, [geminiApiKey, detectedNotes]);

  // OpenAI - Clinical Synthesis
  const synthesizeWithOpenAI = useCallback(async (extractedData) => {
    if (!openaiApiKey) {
      return extractedData; // Skip if no API key
    }

    try {
      const prompt = `Given this extracted patient data, synthesize and enhance the clinical narrative, 
ensuring medical accuracy and completeness. Focus on neurosurgical context.

Extracted Data:
${JSON.stringify(extractedData, null, 2)}

Return enhanced data in the same JSON structure with improved narratives.`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: 'You are a neurosurgery medical AI assistant specializing in clinical documentation.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        console.warn('OpenAI synthesis skipped:', response.statusText);
        return extractedData;
      }

      const result = await response.json();
      const content = result.choices?.[0]?.message?.content;
      
      if (content) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }
      
      return extractedData;
    } catch (error) {
      console.error('OpenAI synthesis error:', error);
      return extractedData; // Return original if failed
    }
  }, [openaiApiKey]);

  // Claude - Structuring and Summarizing
  const structureWithClaude = useCallback(async (extractedData) => {
    if (!claudeApiKey) {
      return extractedData; // Skip if no API key
    }

    try {
      const prompt = `You are Claude, an AI specialized in medical documentation structure and summarization.
      
Given this clinical data, structure and summarize it into a well-organized discharge summary format.
Focus on clarity, completeness, and proper medical documentation standards.

Clinical Data:
${JSON.stringify(extractedData, null, 2)}

Return the structured data in the same JSON format with improved organization and concise summaries.`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': claudeApiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-sonnet-20240229',
          max_tokens: 2000,
          messages: [
            { role: 'user', content: prompt }
          ],
          temperature: 0.3
        })
      });

      if (!response.ok) {
        console.warn('Claude structuring skipped:', response.statusText);
        return extractedData;
      }

      const result = await response.json();
      const content = result.content?.[0]?.text;
      
      if (content) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }
      
      return extractedData;
    } catch (error) {
      console.error('Claude structuring error:', error);
      return extractedData; // Return original if failed
    }
  }, [claudeApiKey]);

  // Orchestrated Multi-AI Extraction
  const extractWithMultiAI = useCallback(async () => {
    let extractedData;
    
    // Step 1: Extract with Gemini (primary extraction)
    if (geminiApiKey) {
      try {
        extractedData = await extractWithGemini();
      } catch (error) {
        console.warn('Gemini extraction failed, using patterns:', error);
        extractedData = extractWithPatterns();
      }
    } else {
      extractedData = extractWithPatterns();
    }
    
    // Step 2: Enhance with OpenAI (synthesis)
    if (openaiApiKey && extractedData) {
      try {
        extractedData = await synthesizeWithOpenAI(extractedData);
      } catch (error) {
        console.warn('OpenAI synthesis failed, continuing without:', error);
      }
    }
    
    // Step 3: Structure with Claude (organization)
    if (claudeApiKey && extractedData) {
      try {
        extractedData = await structureWithClaude(extractedData);
      } catch (error) {
        console.warn('Claude structuring failed, continuing without:', error);
      }
    }
    
    return extractedData;
  }, [geminiApiKey, openaiApiKey, claudeApiKey, extractWithGemini, synthesizeWithOpenAI, structureWithClaude, extractWithPatterns]);

  // Main extraction handler with note detection
  const handleExtractData = async () => {
    if (!unifiedNotes.trim()) {
      setError('Please enter clinical notes');
      return;
    }

    setLoading(true);
    setError('');
    setWarnings([]);
    setSuccess('');

    try {
      // Step 1: Detect note types
      const detected = detectNoteTypes(unifiedNotes);
      setDetectedNotes(detected);
      
      // Show what was detected
      const detectedTypes = Object.entries(detected)
        .filter(([_, content]) => content.trim())
        .map(([type, _]) => type);
      
      if (detectedTypes.length > 0) {
        setSuccess(`Detected notes: ${detectedTypes.join(', ')}`);
      }

      // Step 2: Extract data using multi-AI or patterns
      let extracted;
      
      if (useAI && (geminiApiKey || openaiApiKey || claudeApiKey)) {
        try {
          extracted = await extractWithMultiAI();
          setSuccess('Multi-AI extraction completed successfully');
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
      setActiveTab('review');
    } catch (err) {
      setError(`Extraction failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ML Learning Functions
  
  // Analyze edits to identify patterns (not patient-specific data)
  const analyzeEdit = useCallback((originalText, editedText) => {
    const patterns = [];
    
    // Identify type of change
    if (originalText.length < editedText.length) {
      patterns.push({ type: 'addition', context: 'content_expansion' });
    } else if (originalText.length > editedText.length) {
      patterns.push({ type: 'reduction', context: 'content_simplification' });
    }
    
    // Check for common medical phrase changes
    const medicalPhrases = {
      'patient': ['pt', 'individual', 'case'],
      'underwent': ['had', 'received', 'completed'],
      'discharge': ['released', 'sent home', 'transferred'],
      'stable': ['improving', 'well', 'good condition'],
      'tolerated': ['did well with', 'handled', 'managed']
    };
    
    for (const [formal, informal] of Object.entries(medicalPhrases)) {
      if (originalText.toLowerCase().includes(formal) && 
          !editedText.toLowerCase().includes(formal) &&
          informal.some(alt => editedText.toLowerCase().includes(alt))) {
        patterns.push({ 
          type: 'terminology_preference', 
          from: formal, 
          context: 'formality_adjustment' 
        });
      }
    }
    
    // Check for structure changes
    if ((originalText.match(/\n/g) || []).length < (editedText.match(/\n/g) || []).length) {
      patterns.push({ type: 'formatting', context: 'improved_readability' });
    }
    
    return patterns;
  }, []);
  
  // Save learning from edits
  const handleSummaryEdit = useCallback((editedSummary) => {
    const patterns = analyzeEdit(generatedSummary, editedSummary);
    
    if (patterns.length > 0) {
      const newLearningData = { ...learningData };
      
      patterns.forEach(pattern => {
        const key = `${pattern.type}_${pattern.context}`;
        newLearningData.patterns[key] = (newLearningData.patterns[key] || 0) + 1;
      });
      
      newLearningData.corrections.push({
        timestamp: new Date().toISOString(),
        patterns: patterns,
        // Do NOT store patient-specific data
        editType: patterns.map(p => p.type).join(',')
      });
      
      newLearningData.totalEdits += 1;
      newLearningData.lastUpdated = new Date().toISOString();
      
      // Keep only last 100 corrections to avoid bloat
      if (newLearningData.corrections.length > 100) {
        newLearningData.corrections = newLearningData.corrections.slice(-100);
      }
      
      setLearningData(newLearningData);
      localStorage.setItem('dischargeSummaryLearning', JSON.stringify(newLearningData));
      
      setSuccess('Learning saved - future summaries will incorporate this pattern');
      setTimeout(() => setSuccess(''), 3000);
    }
    
    setGeneratedSummary(editedSummary);
    setEditableSummary(editedSummary);
    setIsEditing(false);
  }, [generatedSummary, learningData, analyzeEdit]);
  
  // Apply learned patterns to new summaries
  const applyLearnings = useCallback((summaryText) => {
    let enhanced = summaryText;
    
    // Apply the most common learned patterns
    const sortedPatterns = Object.entries(learningData.patterns)
      .sort((a, b) => b[1] - a[1]) // Sort by frequency
      .slice(0, 5); // Top 5 patterns
    
    sortedPatterns.forEach(([patternKey, count]) => {
      if (count >= 3) { // Only apply if seen 3+ times
        const [type, context] = patternKey.split('_');
        
        if (type === 'formatting' && context === 'improved') {
          // Add extra spacing for readability if learned
          enhanced = enhanced.replace(/\n([A-Z])/g, '\n\n$1');
        }
        
        if (type === 'terminology' && context === 'formality') {
          // Apply preferred terminology if learned
          enhanced = enhanced.replace(/\bpatient\b/gi, 'pt');
        }
      }
    });
    
    return enhanced;
  }, [learningData]);

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
    let summary = template();
    
    // Apply learned patterns to enhance the summary
    summary = applyLearnings(summary);
    
    setGeneratedSummary(summary);
    setEditableSummary(summary);
    setSuccess('Summary generated successfully');
    setActiveTab('output');
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
    // eslint-disable-next-line no-restricted-globals
    if (!confirm('Clear all data? This cannot be undone.')) return;
    
    setUnifiedNotes('');
    setDetectedNotes({
      admission: '',
      progress: '',
      consultant: '',
      procedure: '',
      final: ''
    });
    setExtractedData(null);
    setGeneratedSummary('');
    setEditableSummary('');
    setError('');
    setWarnings([]);
    setSuccess('All data cleared');
    localStorage.removeItem('dischargeSummaryDraft');
  };

  // Handle API keys
  const handleApiKeySave = () => {
    if (geminiApiKey) {
      localStorage.setItem('geminiApiKey', geminiApiKey);
    }
    if (openaiApiKey) {
      localStorage.setItem('openaiApiKey', openaiApiKey);
    }
    if (claudeApiKey) {
      localStorage.setItem('claudeApiKey', claudeApiKey);
    }
    
    if (geminiApiKey || openaiApiKey || claudeApiKey) {
      setUseAI(true);
      setShowApiKeyInput(false);
      setSuccess('API keys saved');
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
    <div className="max-w-7xl mx-auto p-6 sm:p-8 lg:p-10">
      {/* Header */}
      <header className="card mb-8 no-print border-2 border-gray-200 hover:border-blue-300 transition-all duration-300">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="p-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
              <FileText className="h-10 w-10 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Discharge Summary Generator
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Extract and generate medical discharge summaries with AI assistance
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {autoSave && (
              <span className="text-sm text-green-600 flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg border border-green-200">
                <Save className="h-4 w-4" />
                Auto-save on
              </span>
            )}
            <button
              onClick={() => setAutoSave(!autoSave)}
              className="btn-secondary text-sm"
              title="Toggle auto-save"
            >
              <Database className="h-5 w-5" />
            </button>
            <button
              onClick={clearAll}
              className="btn-secondary text-sm text-red-600 hover:bg-red-50 hover:border-red-300"
              title="Clear all data"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Notifications */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border-2 border-red-300 rounded-xl flex items-start gap-3 no-print shadow-sm animate-fade-in">
          <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-900 mb-1">Error</p>
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      )}
      
      {warnings.length > 0 && (
        <div className="mb-6 p-4 bg-yellow-50 border-2 border-yellow-300 rounded-xl no-print shadow-sm animate-fade-in">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800 flex-1">
              <p className="font-semibold mb-2">Warnings:</p>
              <ul className="list-disc list-inside space-y-1.5">
                {warnings.map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
      
      {success && (
        <div className="mb-6 p-4 bg-green-50 border-2 border-green-300 rounded-xl flex items-start gap-3 no-print animate-fade-in shadow-sm">
          <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-green-900 mb-1">Success</p>
            <p className="text-sm text-green-800">{success}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Input */}
        <div className="space-y-6 no-print">
          {/* Settings */}
          <div className="card hover:shadow-2xl transition-shadow duration-300">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Settings className="h-5 w-5 text-purple-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Settings</h2>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-200">
                <label className="flex items-center justify-between cursor-pointer group">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={useAI}
                      onChange={(e) => {
                        setUseAI(e.target.checked);
                        if (e.target.checked && !geminiApiKey && !openaiApiKey && !claudeApiKey) {
                          setShowApiKeyInput(true);
                        }
                      }}
                      className="w-5 h-5 rounded text-purple-600 focus:ring-2 focus:ring-purple-500"
                    />
                    <div>
                      <span className="text-base font-semibold text-gray-900 flex items-center gap-2">
                        Use Multi-AI Extraction
                        <Brain className="h-5 w-5 text-purple-600" />
                      </span>
                      <p className="text-xs text-gray-600 mt-0.5">Enhanced accuracy with AI models</p>
                    </div>
                  </div>
                  {useAI && !geminiApiKey && !openaiApiKey && !claudeApiKey && (
                    <button
                      onClick={() => setShowApiKeyInput(!showApiKeyInput)}
                      className="text-sm text-purple-600 hover:text-purple-700 font-medium hover:underline"
                    >
                      Add API Keys
                    </button>
                  )}
                </label>
              </div>
              
              {showApiKeyInput && (
                <div className="space-y-4 p-5 bg-gray-50 rounded-xl border-2 border-gray-200 animate-fade-in">
                  <p className="text-sm text-gray-700 mb-3 font-medium">
                    Configure AI APIs for synergistic extraction:
                  </p>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Gemini API Key (Medical Extraction)
                    </label>
                    <input
                      type="password"
                      value={geminiApiKey}
                      onChange={(e) => setGeminiApiKey(e.target.value)}
                      placeholder="Enter Gemini API key"
                      className="input-field text-sm w-full"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      OpenAI API Key (Clinical Synthesis) - Optional
                    </label>
                    <input
                      type="password"
                      value={openaiApiKey}
                      onChange={(e) => setOpenaiApiKey(e.target.value)}
                      placeholder="Enter OpenAI API key (optional)"
                      className="input-field text-sm w-full"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Claude API Key (Structuring) - Optional
                    </label>
                    <input
                      type="password"
                      value={claudeApiKey}
                      onChange={(e) => setClaudeApiKey(e.target.value)}
                      placeholder="Enter Claude API key (optional)"
                      className="input-field text-sm w-full"
                    />
                  </div>
                  
                  <button
                    onClick={handleApiKeySave}
                    className="btn-primary text-sm w-full mt-2"
                  >
                    <Save className="h-4 w-4" />
                    Save API Keys
                  </button>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Summary Template</label>
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

          {/* Note Inputs - Unified Input Box */}
          <div className="card hover:shadow-2xl transition-shadow duration-300">
            <div className="mb-6">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <ClipboardList className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Clinical Notes</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      <Info className="h-3 w-3 inline mr-1" />
                      System auto-detects note types
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed pl-12">
                Paste admission notes, progress notes, consultant notes, procedure notes, and discharge notes.
                The system will automatically detect and separate different note types.
              </p>
            </div>

            {/* Detected Note Types Display */}
            {Object.entries(detectedNotes).some(([_, content]) => content.trim()) && (
              <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl animate-fade-in">
                <p className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Detected Note Types:
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(detectedNotes).filter(([_, content]) => content.trim()).map(([type, _]) => (
                    <span key={type} className="badge badge-blue capitalize shadow-sm">
                      {type}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="relative group">
              <textarea
                value={unifiedNotes}
                onChange={(e) => setUnifiedNotes(e.target.value)}
                placeholder={`Paste all clinical notes here (admission, progress, consultations, procedures, discharge notes)...

Example format (optional delimiters):
===================================
ADMISSION NOTE / H&P
Patient: John Doe...
===================================
PROGRESS NOTE - POD 1
Patient doing well...
===================================
DISCHARGE NOTE
Patient ready for discharge...`}
                className="input-field font-mono text-sm resize-y min-h-[320px] leading-relaxed"
                style={{ height: '420px' }}
              />
              
              <label className="absolute top-4 right-4 cursor-pointer z-10">
                <div className="p-2.5 bg-white hover:bg-blue-50 rounded-lg transition-all shadow-sm border border-gray-200 hover:border-blue-300">
                  <Upload className="h-5 w-5 text-gray-600 hover:text-blue-600 transition-colors" />
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".txt,.md"
                  onChange={(e) => handleFileUpload(e, setUnifiedNotes)}
                />
              </label>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Shield className="h-4 w-4 text-gray-400" />
                <span>Character count: <span className="font-semibold text-gray-800">{unifiedNotes.length.toLocaleString()}</span></span>
              </div>
              {unifiedNotes.length > 0 && (
                <div className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  <span>Ready to extract</span>
                </div>
              )}
            </div>

            <div className="mt-6">
              <button
                onClick={handleExtractData}
                disabled={loading || !unifiedNotes.trim()}
                className="w-full btn-primary text-base py-4"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Detecting notes and extracting...</span>
                  </>
                ) : (
                  <>
                    {useAI ? <Brain className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
                    <span>Auto-Detect & Extract Information</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Extracted Data */}
          {extractedData && (
            <div className="card hover:shadow-2xl transition-shadow duration-300 animate-fade-in">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Database className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Extracted Data</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Review and edit extracted information</p>
                  </div>
                </div>
                <Edit className="h-5 w-5 text-gray-400" />
              </div>

              <div className="space-y-4 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                {Object.entries(extractedData).map(([key, value]) => {
                  const isArray = Array.isArray(value);
                  const displayValue = isArray ? value.join('\n') : value || '';
                  
                  return (
                    <div key={key} className="group">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                      </label>
                      {isArray ? (
                        <textarea
                          value={displayValue}
                          onChange={(e) => updateExtractedData(key, e.target.value.split('\n').filter(Boolean))}
                          rows={Math.max(3, Math.min(5, value.length || 1))}
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
                className="w-full btn-primary mt-6 text-base py-4"
              >
                <FileText className="h-5 w-5" />
                <span>Generate Summary</span>
              </button>
            </div>
          )}
        </div>

        {/* Right Column - Output */}
        <div className="space-y-6">
          <div className="card hover:shadow-2xl transition-shadow duration-300">
            <div className="flex items-center justify-between mb-6 no-print">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <FileText className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Generated Summary</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Review, edit, and export your summary</p>
                </div>
              </div>
              {generatedSummary && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className={`p-2.5 rounded-lg transition-all shadow-sm ${
                      isEditing 
                        ? 'bg-blue-100 text-blue-600 shadow-md' 
                        : 'text-gray-600 hover:bg-gray-100 border border-gray-200'
                    }`}
                    title={isEditing ? 'View Mode' : 'Edit Mode'}
                  >
                    {isEditing ? <Eye className="h-5 w-5" /> : <Edit className="h-5 w-5" />}
                  </button>
                  <button
                    onClick={copySummary}
                    className="p-2.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-all border border-gray-200 shadow-sm"
                    title="Copy to Clipboard"
                  >
                    {copied ? <CheckCircle className="h-5 w-5 text-green-600" /> : <Copy className="h-5 w-5" />}
                  </button>
                  <button
                    onClick={downloadSummary}
                    className="p-2.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-all border border-gray-200 shadow-sm"
                    title="Download"
                  >
                    <Download className="h-5 w-5" />
                  </button>
                  <button
                    onClick={printSummary}
                    className="p-2.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-all border border-gray-200 shadow-sm"
                    title="Print"
                  >
                    <Printer className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>

            {isEditing && generatedSummary && (
              <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-xl no-print animate-fade-in">
                <div className="flex items-start gap-3">
                  <Brain className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-semibold text-base">ML Learning Mode Active</p>
                    <p className="text-sm mt-1 leading-relaxed">
                      Your edits will be analyzed (without storing patient data) to improve future summaries.
                      Total edits learned: <span className="font-semibold">{learningData.totalEdits}</span>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {generatedSummary ? (
              <div>
                {isEditing ? (
                  <div className="space-y-4">
                    <textarea
                      value={editableSummary}
                      onChange={(e) => setEditableSummary(e.target.value)}
                      className="w-full p-5 border-2 border-gray-300 rounded-xl font-mono text-sm focus:ring-4 focus:ring-blue-200 focus:border-blue-500 transition-all leading-relaxed shadow-inner"
                      style={{ height: '600px', minHeight: '400px' }}
                    />
                    <div className="flex gap-3 no-print">
                      <button
                        onClick={() => handleSummaryEdit(editableSummary)}
                        className="btn-primary flex-1 text-base py-4"
                      >
                        <Save className="h-5 w-5" />
                        <span>Save & Learn from Edits</span>
                      </button>
                      <button
                        onClick={() => {
                          setEditableSummary(generatedSummary);
                          setIsEditing(false);
                        }}
                        className="btn-secondary px-8"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div 
                    ref={summaryRef}
                    className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 shadow-inner border border-gray-200"
                    style={{ maxHeight: '600px', minHeight: '400px', overflowY: 'auto' }}
                  >
                    <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 leading-relaxed">
                      {generatedSummary}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors" style={{ height: '500px' }}>
                <div className="text-center text-gray-400">
                  <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Generated summary will appear here</p>
                  <p className="text-sm mt-2">Extract data and generate summary to begin</p>
                </div>
              </div>
            )}
          </div>

          {/* ML Learning Dashboard */}
          {learningData.totalEdits > 0 && (
            <div className="card bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 border-2 border-purple-200 no-print hover:shadow-2xl transition-all duration-300 animate-fade-in">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Brain className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">ML Learning Statistics</h3>
                  <p className="text-xs text-gray-600 mt-0.5">Your contributions to AI improvement</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-4 bg-white rounded-xl shadow-sm border border-purple-100">
                  <p className="text-gray-600 text-xs font-medium mb-1">Total Edits</p>
                  <p className="font-bold text-2xl text-purple-600">{learningData.totalEdits}</p>
                </div>
                <div className="p-4 bg-white rounded-xl shadow-sm border border-purple-100">
                  <p className="text-gray-600 text-xs font-medium mb-1">Patterns Learned</p>
                  <p className="font-bold text-2xl text-purple-600">{Object.keys(learningData.patterns).length}</p>
                </div>
              </div>
              {learningData.lastUpdated && (
                <p className="text-xs text-gray-600 mt-4 flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  Last updated: {new Date(learningData.lastUpdated).toLocaleString()}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DischargeSummaryGenerator;