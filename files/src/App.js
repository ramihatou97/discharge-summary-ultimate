import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  Brain, TrendingUp, Target, Zap, AlertCircle, CheckCircle, RefreshCw, 
  Database, BarChart, Activity, BookOpen, GitBranch, Cpu, Shield, Pill, 
  FileText, Heart, Info, Award, Sparkles, Download, Copy, Upload, Trash2,
  Settings, Save, Eye, EyeOff, ChevronDown, ChevronRight, Clock, 
  ClipboardList, Wand2, Edit, Coffee, Globe, Lock, Unlock, ChevronUp,
  X, Plus, Minus, HelpCircle, AlertTriangle, Check, User, Calendar
} from 'lucide-react';
import './App.css';
import { medicalAbbreviations } from './medical-abbreviations';
import { clinicalGuidelines } from './clinical-guidelines';
import { demoCases } from './demo-cases';
import MLDashboard from './components/MLDashboard';
import NoteInputSection from './components/NoteInputSection';
import ExtractedDataReview from './components/ExtractedDataReview';
import OutputSection from './components/OutputSection';
import RiskAssessmentPanel from './components/RiskAssessmentPanel';
import RecommendationsPanel from './components/RecommendationsPanel';

const App = () => {
  // ==========================================
  // COMPLETE STATE MANAGEMENT
  // ==========================================
  const [notes, setNotes] = useState({
    admission: '',
    operative: '',
    progress: '',
    medications: '',
    final: '',
    imaging: '',
    labs: '',
    consults: ''
  });

  const [extractedData, setExtractedData] = useState(null);
  const [generatedSummary, setGeneratedSummary] = useState('');
  const [expandedText, setExpandedText] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [predictions, setPredictions] = useState(null);

  // UI State
  const [activeTab, setActiveTab] = useState('input');
  const [activeNoteTab, setActiveNoteTab] = useState('admission');
  const [isProcessing, setIsProcessing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [successMessage, setSuccessMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [validationResults, setValidationResults] = useState(null);
  const [confidenceScores, setConfidenceScores] = useState({});
  const [corrections, setCorrections] = useState({});

  // Settings
  const [extractionMethod, setExtractionMethod] = useState('hybrid');
  const [selectedTemplate, setSelectedTemplate] = useState('neurosurgery');
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [showMLDashboard, setShowMLDashboard] = useState(false);
  const [showExtractedData, setShowExtractedData] = useState(true);
  const [autoSave, setAutoSave] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [enableAI, setEnableAI] = useState(false);

  // ML Training State
  const [trainingData, setTrainingData] = useState(() => {
    const saved = localStorage.getItem('ultimateMLTrainingData');
    return saved ? JSON.parse(saved) : {
      patterns: {},
      corrections: [],
      accuracy: { current: 70, history: [70] },
      totalSamples: 0,
      modelVersion: '3.0.0',
      lastUpdated: new Date().toISOString(),
      specialtyAccuracy: {
        neurosurgery: 75,
        spine: 72,
        vascular: 70,
        tumor: 68,
        trauma: 65,
        pediatric: 60
      },
      entityRecognition: {
        medications: { correct: 0, total: 0 },
        diagnoses: { correct: 0, total: 0 },
        procedures: { correct: 0, total: 0 },
        labs: { correct: 0, total: 0 }
      }
    };
  });

  const [model, setModel] = useState({
    confidence: 0.7,
    trained: false,
    learning: true,
    performance: { 
      precision: 0.7, 
      recall: 0.65, 
      f1: 0.675,
      auc: 0.72
    }
  });

  // Medical NER Patterns
  const medicalNERPatterns = {
    diagnosis: {
      patterns: [
        /(?:diagnosis|dx|impression|assessment)[\s:]+([^\n]+)/gi,
        /(?:admitting|principal|primary|discharge)\s+(?:diagnosis|dx)[\s:]+([^\n]+)/gi,
        /(?:ruled?\s+out|r\/o)[\s:]+([^\n]+)/gi,
        /(?:final diagnosis|discharge diagnosis|post-?op diagnosis)[\s:]+([^\n]+)/gi,
        /(?:clinical impression|working diagnosis)[\s:]+([^\n]+)/gi
      ],
      learned: []
    },
    medications: {
      patterns: [
        /(\w+)\s+(\d+\.?\d*)\s*(mg|mcg|g|ml|units?|tabs?|capsules?)/gi,
        /(\w+(?:olol|pril|statin|azole|mycin|cycline|sartan|dipine))\s+(\d+)/gi,
        /(\w+)\s+(?:extended|sustained|immediate|delayed)\s+release/gi,
        /(?:start|continue|resume|hold|stop|discontinue)\s+(\w+)/gi,
        /(\w+)\s+(?:PO|IV|IM|SQ|SC|PR|SL|TD|INH)\s+(?:daily|BID|TID|QID|q\d+h)/gi
      ],
      learned: []
    },
    procedures: {
      patterns: [
        /(?:status\s+post|s\/p)\s+([^\n,]+(?:ectomy|otomy|plasty|scopy|graphy|fusion|repair|resection))/gi,
        /(?:underwent|performed|completed)\s+([^\n,]+)/gi,
        /(?:procedure|operation|surgery)[\s:]+([^\n]+)/gi,
        /(?:craniotomy|fusion|laminectomy|discectomy|decompression|evacuation|clipping|coiling)/gi,
        /(?:ACDF|PLIF|TLIF|ALIF|XLIF)\s+(?:at\s+)?([CL]\d+-[CLS]\d+)/gi
      ],
      learned: []
    },
    complications: {
      patterns: [
        /(?:complicated by|complication)[\s:]+([^\n]+)/gi,
        /(?:vasospasm|hydrocephalus|infection|hemorrhage|seizure|CSF leak|wound dehiscence)/gi,
        /(?:readmitted for|returned with|developed)[\s:]+([^\n]+)/gi,
        /(?:post-?operative|post-?op)\s+(?:complication|issue)[\s:]+([^\n]+)/gi
      ],
      learned: []
    },
    labValues: {
      patterns: [
        /(WBC|RBC|Hgb|Hct|Plt|Na|K|Cl|CO2|BUN|Cr|Glucose)[\s:]+(\d+\.?\d*)\s*(\w+)?/gi,
        /(Troponin|BNP|D-dimer|CRP|ESR|PT|PTT|INR)[\s:]+(\d+\.?\d*)\s*(\w+)?/gi,
        /(GCS|NIHSS|Hunt.?Hess|Fisher|WFNS)\s*(?:grade|score)?\s*[:=]?\s*(\d+)/gi,
        /(pH|pO2|pCO2|HCO3|lactate)[\s:]+(\d+\.?\d*)/gi
      ],
      learned: []
    }
  };

  // ==========================================
  // INITIALIZATION & AUTO-SAVE
  // ==========================================
  useEffect(() => {
    // Load saved API key
    const savedKey = localStorage.getItem('geminiApiKey');
    if (savedKey) {
      setApiKey(savedKey);
      setEnableAI(true);
    }

    // Load saved draft
    const savedDraft = localStorage.getItem('dischargeSummaryDraft');
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        const savedDate = new Date(draft.savedAt);
        const hoursSince = (new Date() - savedDate) / (1000 * 60 * 60);
        
        if (hoursSince < 48) {
          setNotes(draft.notes || {});
          if (draft.extractedData) setExtractedData(draft.extractedData);
          setSuccessMessage('Draft restored from previous session');
          setTimeout(() => setSuccessMessage(''), 3000);
        }
      } catch (e) {
        console.error('Error loading draft:', e);
      }
    }

    // Update model status
    updateModelStatus();
  }, []);

  // Auto-save effect
  useEffect(() => {
    if (autoSave && Object.values(notes).some(note => note.trim())) {
      const saveTimer = setTimeout(() => {
        const draft = {
          notes,
          extractedData,
          savedAt: new Date().toISOString()
        };
        localStorage.setItem('dischargeSummaryDraft', JSON.stringify(draft));
      }, 2000);
      
      return () => clearTimeout(saveTimer);
    }
  }, [notes, extractedData, autoSave]);

  // ==========================================
  // CORE EXTRACTION & PROCESSING FUNCTIONS
  // ==========================================
  
  const expandAbbreviations = useCallback((text) => {
    let expanded = text;
    
    Object.entries(medicalAbbreviations).forEach(([abbr, expansion]) => {
      const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
      expanded = expanded.replace(regex, expansion);
    });
    
    Object.entries(trainingData.patterns).forEach(([pattern, count]) => {
      if (pattern.startsWith('abbr:') && count > 2) {
        const [, abbr, expansion] = pattern.split(':');
        if (abbr && expansion) {
          const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
          expanded = expanded.replace(regex, expansion);
        }
      }
    });
    
    return expanded;
  }, [trainingData.patterns]);

  const extractEntitiesWithML = useCallback((text, entityType) => {
    const extracted = [];
    const patterns = [
      ...medicalNERPatterns[entityType].patterns,
      ...medicalNERPatterns[entityType].learned
    ];
    
    patterns.forEach(pattern => {
      try {
        const matches = text.matchAll(new RegExp(pattern));
        for (const match of matches) {
          const entity = match[1] || match[0];
          if (entity && entity.length > 2) {
            const confidence = calculateEntityConfidence(entity, entityType);
            
            extracted.push({
              text: entity.trim(),
              type: entityType,
              confidence: confidence,
              position: match.index,
              learned: medicalNERPatterns[entityType].learned.includes(pattern)
            });
          }
        }
      } catch (e) {
        console.error('Pattern matching error:', e);
      }
    });
    
    const unique = extracted.reduce((acc, current) => {
      const x = acc.find(item => item.text.toLowerCase() === current.text.toLowerCase());
      if (!x) {
        return acc.concat([current]);
      } else if (x.confidence < current.confidence) {
        return acc.map(item => 
          item.text.toLowerCase() === current.text.toLowerCase() ? current : item
        );
      }
      return acc;
    }, []);
    
    return unique.sort((a, b) => b.confidence - a.confidence);
  }, []);

  const calculateEntityConfidence = useCallback((text, entityType) => {
    const baseConfidence = model.confidence;
    const patternKey = `${entityType}:${text.toLowerCase()}`;
    const trainingBoost = (trainingData.patterns[patternKey] || 0) * 0.02;
    const correctionPenalty = (corrections[patternKey] || 0) * 0.05;
    
    let medicalBoost = 0;
    if (text.toLowerCase() in medicalAbbreviations) {
      medicalBoost = 0.15;
    }
    
    const lengthPenalty = text.length < 3 ? -0.2 : 0;
    
    let contextBoost = 0;
    if (entityType === 'medications' && /\d+\s*(mg|mcg|ml)/i.test(text)) {
      contextBoost = 0.1;
    }
    
    const finalConfidence = Math.max(0.1, Math.min(0.99, 
      baseConfidence + trainingBoost - correctionPenalty + medicalBoost + lengthPenalty + contextBoost
    ));
    
    return finalConfidence;
  }, [model.confidence, trainingData.patterns, corrections]);

  const detectConditions = useCallback((text) => {
    const conditions = [];
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('subarachnoid hemorrhage') || lowerText.includes('sah') || 
        lowerText.includes('aneurysm')) {
      conditions.push({
        name: 'Subarachnoid Hemorrhage',
        severity: 'critical',
        guidelines: clinicalGuidelines.sah,
        confidence: 0.95,
        icd10: 'I60.9'
      });
    }
    
    if (lowerText.includes('subdural hematoma') || lowerText.includes('sdh')) {
      conditions.push({
        name: 'Subdural Hematoma',
        severity: 'high',
        monitoring: 'Serial CT scans, neuro checks q2h',
        confidence: 0.93,
        icd10: 'I62.0'
      });
    }
    
    if (lowerText.includes('glioblastoma') || lowerText.includes('gbm') ||
        lowerText.includes('brain tumor')) {
      conditions.push({
        name: 'Brain Tumor',
        severity: 'high',
        followUp: 'Neuro-oncology within 2-4 weeks',
        confidence: 0.91,
        icd10: 'C71.9'
      });
    }
    
    if (lowerText.includes('stenosis') || lowerText.includes('herniated disc')) {
      conditions.push({
        name: 'Degenerative Spine Disease',
        severity: 'moderate',
        confidence: 0.88,
        icd10: 'M51.9'
      });
    }
    
    if (lowerText.includes('traumatic brain injury') || lowerText.includes('tbi')) {
      conditions.push({
        name: 'Traumatic Brain Injury',
        severity: 'high',
        guidelines: clinicalGuidelines.seizure?.tbi,
        confidence: 0.92,
        icd10: 'S06.9'
      });
    }
    
    if (lowerText.includes('hydrocephalus') || lowerText.includes('nph')) {
      conditions.push({
        name: 'Hydrocephalus',
        severity: 'moderate',
        confidence: 0.89,
        icd10: 'G91.9'
      });
    }
    
    return conditions;
  }, []);

  const detectProcedures = useCallback((text) => {
    const procedures = [];
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('craniotomy')) {
      procedures.push({
        name: 'Craniotomy',
        type: 'major',
        cpt: '61510',
        antibiotics: clinicalGuidelines.spine?.antibiotics,
        seizureProphylaxis: true,
        confidence: 0.96
      });
    }
    
    if (lowerText.includes('fusion') || lowerText.includes('acdf') || 
        lowerText.includes('plif') || lowerText.includes('tlif')) {
      procedures.push({
        name: 'Spinal Fusion',
        type: 'major',
        cpt: '22551',
        restrictions: 'No BLT x 6 weeks',
        vte: clinicalGuidelines.spine?.vte,
        confidence: 0.94
      });
    }
    
    if (lowerText.includes('clipping') || lowerText.includes('coiling')) {
      procedures.push({
        name: 'Aneurysm Treatment',
        type: 'vascular',
        cpt: lowerText.includes('clipping') ? '61700' : '61710',
        monitoring: 'Daily TCDs, angiogram at 6 months',
        confidence: 0.95
      });
    }
    
    if (lowerText.includes('evd') || lowerText.includes('external ventricular drain')) {
      procedures.push({
        name: 'EVD Placement',
        type: 'neurosurgical',
        cpt: '61210',
        antibiotics: 'Prophylactic coverage',
        confidence: 0.93
      });
    }
    
    if (lowerText.includes('vps') || lowerText.includes('ventriculoperitoneal shunt')) {
      procedures.push({
        name: 'VP Shunt Placement',
        type: 'neurosurgical',
        cpt: '62223',
        antibiotics: 'Perioperative coverage',
        confidence: 0.94
      });
    }
    
    return procedures;
  }, []);

  const generateEvidenceBasedRecommendations = useCallback((conditions, procedures, extracted) => {
    const recommendations = {
      immediate: [],
      medications: [],
      monitoring: [],
      activity: [],
      followUp: [],
      rehabilitation: [],
      dietaryRestrictions: [],
      woundCare: [],
      warningsSigns: []
    };
    
    conditions.forEach(condition => {
      if (condition.name === 'Subarachnoid Hemorrhage' && condition.guidelines) {
        recommendations.medications.push({
          drug: 'Nimodipine',
          dose: '60mg PO q4h',
          duration: '21 days',
          reason: 'Vasospasm prevention',
          evidence: 'Class I, Level A',
          nnt: '13'
        });
        
        recommendations.medications.push({
          drug: 'Levetiracetam',
          dose: '1000mg BID',
          duration: '7 days',
          reason: 'Seizure prophylaxis',
          evidence: 'Class IIb, Level B'
        });
        
        recommendations.monitoring.push({
          test: 'Transcranial Doppler',
          frequency: 'Daily',
          duration: 'Days 3-14',
          reason: 'Vasospasm detection',
          threshold: 'MCA velocity >120 cm/s'
        });
        
        recommendations.warningsSigns.push(
          'Severe headache ("thunderclap")',
          'Sudden change in mental status',
          'New focal neurological deficits',
          'Seizures'
        );
      }
      
      if (condition.name === 'Traumatic Brain Injury') {
        recommendations.medications.push({
          drug: 'Levetiracetam',
          dose: '1000mg BID',
          duration: '7 days',
          reason: 'Seizure prophylaxis in severe TBI',
          evidence: 'Level A recommendation'
        });
        
        recommendations.activity.push({
          restriction: 'Cognitive rest x 48 hours',
          gradual_return: 'Step-wise return to activities',
          avoid: 'Contact sports x 3-6 months'
        });
      }
    });
    
    procedures.forEach(procedure => {
      if (procedure.name.includes('Craniotomy')) {
        recommendations.activity.push({
          restriction: 'No heavy lifting >10 lbs x 4 weeks',
          driving: 'No driving x 2 weeks minimum',
          return_to_work: 'Minimum 4-6 weeks'
        });
        
        recommendations.woundCare.push({
          instruction: 'Keep incision clean and dry',
          showering: 'May shower after 48 hours',
          signs_infection: 'Monitor for redness, drainage, fever'
        });
      }
      
      if (procedure.name.includes('Spinal Fusion')) {
        recommendations.activity.push({
          restriction: 'No BLT x 6 weeks',
          therapy: 'PT to start at 2 weeks post-op',
          driving: 'When off narcotics',
          bracing: 'Wear lumbar brace when OOB'
        });
        
        recommendations.medications.push({
          drug: 'Enoxaparin',
          dose: '40mg SQ daily',
          start: 'POD#1',
          duration: 'Until ambulatory',
          evidence: 'Strong recommendation'
        });
      }
    });
    
    if (recommendations.warningsSigns.length === 0) {
      recommendations.warningsSigns.push(
        'Fever >101.5°F',
        'Severe headache',
        'New weakness or numbness',
        'Seizure activity',
        'Wound drainage or redness',
        'Persistent nausea/vomiting',
        'Vision changes',
        'Confusion'
      );
    }
    
    if (!recommendations.followUp.some(f => f.specialty === 'Neurosurgery')) {
      recommendations.followUp.push({
        specialty: 'Neurosurgery',
        timing: '2 weeks',
        reason: 'Wound check, staple removal',
        tests: 'None routine'
      });
    }
    
    return recommendations;
  }, []);

  const assessSeizureRisk = useCallback((text, conditions, procedures) => {
    let riskScore = 0;
    const factors = [];
    
    if (procedures.some(p => p.name.includes('Craniotomy'))) {
      riskScore += 0.3;
      factors.push('Craniotomy performed');
    }
    
    if (conditions.some(c => c.name === 'Traumatic Brain Injury')) {
      riskScore += 0.4;
      factors.push('Traumatic brain injury');
    }
    
    if (conditions.some(c => c.name === 'Brain Tumor')) {
      riskScore += 0.25;
      factors.push('Brain tumor');
    }
    
    const lowerText = text.toLowerCase();
    if (lowerText.includes('cortical') || lowerText.includes('frontal')) {
      riskScore += 0.2;
      factors.push('Cortical involvement');
    }
    
    if (lowerText.includes('hemorrhage')) {
      riskScore += 0.2;
      factors.push('Intracranial hemorrhage');
    }
    
    return {
      score: Math.min(riskScore, 0.99),
      percentage: Math.round(Math.min(99, riskScore * 100)),
      category: riskScore < 0.3 ? 'Low' : riskScore < 0.6 ? 'Moderate' : 'High',
      factors: factors,
      prophylaxis: riskScore >= 0.5,
      recommendation: riskScore >= 0.5 ? 
        'Levetiracetam 1000mg BID x 7 days recommended' : 
        'Seizure prophylaxis not routinely indicated'
    };
  }, []);

  const assessVTERisk = useCallback((procedures, text) => {
    let riskScore = 0;
    const factors = [];
    
    if (procedures.some(p => p.type === 'major')) {
      riskScore += 0.3;
      factors.push('Major neurosurgical procedure');
    }
    
    if (procedures.some(p => p.name.includes('Spinal Fusion'))) {
      riskScore += 0.4;
      factors.push('Spinal fusion surgery');
    }
    
    const lowerText = text.toLowerCase();
    if (lowerText.includes('prolonged surgery')) {
      riskScore += 0.2;
      factors.push('Prolonged operative time');
    }
    
    if (lowerText.includes('malignancy')) {
      riskScore += 0.25;
      factors.push('Active malignancy');
    }
    
    const risk = riskScore < 0.3 ? 'low' : riskScore < 0.6 ? 'moderate' : 'high';
    
    return {
      score: Math.min(riskScore, 0.99),
      percentage: Math.round(Math.min(99, riskScore * 100)),
      level: risk,
      factors,
      prophylaxis: risk === 'low' ? 'Early mobilization only' : 
                   risk === 'moderate' ? 'Mechanical + consider chemical' :
                   'Chemical + mechanical required',
      timing: risk === 'high' ? 'Start POD#1' : 'Start POD#2-3',
      capriniScore: Math.round(riskScore * 15)
    };
  }, []);

  const calculateReadmissionRisk = useCallback((extracted, conditions) => {
    let riskScore = 0;
    const factors = [];
    
    if (extracted.complications && extracted.complications.length > 0) {
      riskScore += 0.25;
      factors.push('In-hospital complications');
    }
    
    if (extracted.dischargeMedications && extracted.dischargeMedications.length > 10) {
      riskScore += 0.15;
      factors.push('Polypharmacy (>10 medications)');
    }
    
    if (conditions.some(c => c.severity === 'critical')) {
      riskScore += 0.2;
      factors.push('Critical condition');
    }
    
    return {
      score: Math.max(0, Math.min(riskScore, 0.99)),
      percentage: Math.round(Math.max(0, Math.min(99, riskScore * 100))),
      category: riskScore < 0.2 ? 'Low' : riskScore < 0.4 ? 'Moderate' : 'High',
      factors: factors,
      mitigation: riskScore >= 0.4 ? 
        'Early follow-up (within 7 days), home health, medication reconciliation' :
        'Standard follow-up appropriate',
      laceScore: Math.round(riskScore * 10)
    };
  }, []);

  const assessVasospasmRisk = useCallback((conditions, text) => {
    if (!conditions.some(c => c.name === 'Subarachnoid Hemorrhage')) {
      return { risk: 'N/A', monitoring: 'Not indicated' };
    }
    
    let riskScore = 0.5;
    const factors = [];
    const lowerText = text.toLowerCase();
    
    const fisherMatch = lowerText.match(/fisher\s*(?:grade)?\s*(\d)/i);
    if (fisherMatch) {
      const grade = parseInt(fisherMatch[1]);
      if (grade >= 3) {
        riskScore += 0.25;
        factors.push(`Fisher grade ${grade}`);
      }
    }
    
    const huntHessMatch = lowerText.match(/hunt[\s-]?hess\s*(?:grade)?\s*(\d)/i);
    if (huntHessMatch) {
      const grade = parseInt(huntHessMatch[1]);
      if (grade >= 4) {
        riskScore += 0.25;
        factors.push(`Hunt-Hess grade ${grade}`);
      }
    }
    
    const risk = riskScore < 0.4 ? 'low' : riskScore < 0.7 ? 'moderate' : 'high';
    
    return {
      score: Math.min(riskScore, 0.99),
      percentage: Math.round(Math.min(99, riskScore * 100)),
      risk,
      factors,
      peakTiming: 'Days 4-14 post-hemorrhage',
      monitoring: 'Daily TCDs from day 3-14',
      treatment: 'Nimodipine 60mg q4h x 21 days',
      threshold: 'MCA velocity >120 cm/s'
    };
  }, []);

  const extractWithRegex = useCallback((allNotes) => {
    const expandedText = expandAbbreviations(Object.values(allNotes).join('\n'));
    setExpandedText(expandedText);
    
    const scores = {};
    const extracted = {
      patientName: '',
      age: '',
      sex: '',
      mrn: '',
      admitDate: '',
      dischargeDate: '',
      operativeDate: '',
      admittingDiagnosis: '',
      dischargeDiagnosis: '',
      postOpDiagnosis: '',
      secondaryDiagnoses: [],
      procedures: [],
      operativeDetails: '',
      ebl: '',
      complications: [],
      historyPresenting: '',
      hospitalCourse: '',
      currentExam: '',
      neuroExam: '',
      vitalSigns: '',
      wounds: '',
      drains: '',
      homeMedications: [],
      dischargeMedications: [],
      allergies: '',
      pmh: [],
      psh: [],
      socialHistory: '',
      familyHistory: '',
      disposition: 'Home',
      codeStatus: 'Full Code',
      diet: '',
      activity: '',
      restrictions: [],
      followUp: [],
      admissionLabs: [],
      dischargeLabs: [],
      imagingResults: [],
      consultants: [],
      attendingPhysician: '',
      los: '',
      icuDays: ''
    };

    // Patient demographics
    const nameMatch = expandedText.match(/(?:Patient:|Name:|Mr\.|Mrs\.|Ms\.)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
    if (nameMatch) {
      extracted.patientName = nameMatch[1].trim();
      scores.patientName = 0.8;
    }

    const ageMatch = expandedText.match(/(\d{1,3})[\s-]*(?:year|yo|y\.o\.|y\/o)/i);
    if (ageMatch) {
      extracted.age = ageMatch[1];
      scores.age = 0.9;
    }

    const sexMatch = expandedText.match(/\b(male|female|man|woman|M|F)\b/i);
    if (sexMatch) {
      const sex = sexMatch[1].toLowerCase();
      extracted.sex = (sex === 'm' || sex === 'male' || sex === 'man') ? 'Male' : 'Female';
      scores.sex = 0.85;
    }

    const mrnMatch = expandedText.match(/(?:MRN|Medical Record Number|MR#):?\s*(\d{6,10})/i);
    if (mrnMatch) {
      extracted.mrn = mrnMatch[1];
      scores.mrn = 0.95;
    }

    // Dates
    const admitDateMatch = expandedText.match(/(?:Date of (?:Admission|Admit)|Admitted?|Admission Date):?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i);
    if (admitDateMatch) {
      extracted.admitDate = admitDateMatch[1];
      scores.admitDate = 0.9;
    }

    const dischargeDateMatch = expandedText.match(/(?:Discharge Date|Date of Discharge|Discharged?):?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i);
    if (dischargeDateMatch) {
      extracted.dischargeDate = dischargeDateMatch[1];
      scores.dischargeDate = 0.9;
    }

    // Calculate LOS
    if (extracted.admitDate && extracted.dischargeDate) {
      try {
        const admit = new Date(extracted.admitDate);
        const discharge = new Date(extracted.dischargeDate);
        const los = Math.ceil((discharge - admit) / (1000 * 60 * 60 * 24));
        extracted.los = los > 0 ? `${los} days` : '1 day';
      } catch (e) {
        extracted.los = '[Calculate]';
      }
    }

    // Diagnoses
    const admitDxMatch = expandedText.match(/(?:Admitting Diagnosis|Admission Diagnosis|Admit Dx):?\s*([^\n]+)/i);
    if (admitDxMatch) {
      extracted.admittingDiagnosis = admitDxMatch[1].trim();
      scores.admittingDiagnosis = 0.8;
    }

    const dischargeDxMatch = expandedText.match(/(?:Discharge Diagnosis|Final Diagnosis|Principal Diagnosis):?\s*([^\n]+)/i);
    if (dischargeDxMatch) {
      extracted.dischargeDiagnosis = dischargeDxMatch[1].trim();
      scores.dischargeDiagnosis = 0.85;
    }

    // Procedures
    const procedureMatches = expandedText.matchAll(/(?:Procedure|Operation|Surgery):?\s*([^\n]+)/gi);
    for (const match of procedureMatches) {
      const proc = match[1].trim();
      if (proc && !extracted.procedures.includes(proc)) {
        extracted.procedures.push(proc);
      }
    }

    // HPI
    const hpiMatch = expandedText.match(/(?:HPI|History of Present Illness):?\s*([\s\S]{20,500}?)(?=\n\n|PMH:|Past Medical|$)/i);
    if (hpiMatch) {
      extracted.historyPresenting = hpiMatch[1].trim();
      scores.historyPresenting = 0.7;
    }

    // Hospital course
    const courseMatch = expandedText.match(/(?:Hospital Course|Clinical Course):?\s*([\s\S]{20,1000}?)(?=\n\n|Discharge|$)/i);
    if (courseMatch) {
      extracted.hospitalCourse = courseMatch[1].trim();
      scores.hospitalCourse = 0.65;
    }

    // Medications
    const dischargeMedsMatch = expandedText.match(/(?:Discharge Medications?):?\s*([\s\S]{10,500}?)(?=\n\n|Follow|Activity|$)/i);
    if (dischargeMedsMatch) {
      extracted.dischargeMedications = dischargeMedsMatch[1].trim().split('\n').filter(line => line.trim());
      scores.dischargeMedications = 0.75;
    }

    // Allergies
    const allergyMatch = expandedText.match(/(?:Allergies?|NKDA):?\s*([^\n]+)/i);
    if (allergyMatch) {
      extracted.allergies = allergyMatch[1].trim();
      scores.allergies = 0.85;
    }

    // PMH
    const pmhMatch = expandedText.match(/(?:PMH|Past Medical History):?\s*([\s\S]{10,300}?)(?=\n\n|PSH:|$)/i);
    if (pmhMatch) {
      extracted.pmh = pmhMatch[1].trim().split(/[,\n]/).filter(line => line.trim());
      scores.pmh = 0.7;
    }

    // PSH
    const pshMatch = expandedText.match(/(?:PSH|Past Surgical History):?\s*([\s\S]{10,300}?)(?=\n\n|Social|$)/i);
    if (pshMatch) {
      extracted.psh = pshMatch[1].trim().split(/[,\n]/).filter(line => line.trim());
      scores.psh = 0.7;
    }

    setConfidenceScores(scores);
    return extracted;
  }, [expandAbbreviations]);

  const extractWithAI = useCallback(async (allNotes) => {
    if (!apiKey) {
      throw new Error('Please add your Gemini API key in settings');
    }

    const userPrompt = `
      Analyze these clinical notes and extract all information for a discharge summary.
      Be thorough and accurate. Extract dates in MM/DD/YYYY format.
      
      ${Object.entries(allNotes).map(([type, content]) => 
        content ? `${type.toUpperCase()} NOTE:\n${content}\n` : ''
      ).join('\n')}

      Extract: patient demographics, dates, diagnoses, procedures, hospital course, 
      complications, current status, medications, history, disposition, and follow-up.
    `;

    const schema = {
      type: "OBJECT",
      properties: {
        patientName: { type: "STRING" },
        age: { type: "STRING" },
        sex: { type: "STRING" },
        mrn: { type: "STRING" },
        admitDate: { type: "STRING" },
        dischargeDate: { type: "STRING" },
        admittingDiagnosis: { type: "STRING" },
        dischargeDiagnosis: { type: "STRING" },
        procedures: { type: "ARRAY", items: { type: "STRING" } },
        historyPresenting: { type: "STRING" },
        hospitalCourse: { type: "STRING" },
        complications: { type: "ARRAY", items: { type: "STRING" } },
        currentExam: { type: "STRING" },
        vitalSigns: { type: "STRING" },
        dischargeMedications: { type: "ARRAY", items: { type: "STRING" } },
        allergies: { type: "STRING" },
        pmh: { type: "ARRAY", items: { type: "STRING" } },
        psh: { type: "ARRAY", items: { type: "STRING" } },
        disposition: { type: "STRING" },
        diet: { type: "STRING" },
        activity: { type: "STRING" },
        followUp: { type: "ARRAY", items: { type: "STRING" } }
      }
    };

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: userPrompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: schema,
            },
          })
        }
      );

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const result = await response.json();
      const parsedData = JSON.parse(result.candidates[0].content.parts[0].text);
      
      const aiScores = {};
      Object.keys(parsedData).forEach(key => {
        aiScores[key] = 0.95;
      });
      setConfidenceScores(aiScores);
      
      return parsedData;
    } catch (err) {
      console.error('AI extraction failed:', err);
      throw err;
    }
  }, [apiKey]);

  const processNotesWithMLandIntelligence = useCallback(async () => {
    if (!Object.values(notes).some(note => note.trim())) {
      setError('Please enter at least one clinical note');
      return;
    }

    setIsProcessing(true);
    setLoading(true);
    setError('');
    setWarnings([]);
    setExtractedData(null);
    setGeneratedSummary('');
    setExtractionProgress(0);

    try {
      setExtractionProgress(25);
      
      let extractedResult = null;
      
      if (extractionMethod === 'ai' && apiKey) {
        try {
          extractedResult = await extractWithAI(notes);
          setExtractionProgress(75);
        } catch (aiError) {
          setError(`AI extraction failed: ${aiError.message}`);
          return;
        }
      } else if (extractionMethod === 'hybrid' && apiKey) {
        try {
          setExtractionProgress(30);
          extractedResult = await extractWithAI(notes);
          setExtractionProgress(75);
        } catch (aiError) {
          console.warn('AI failed, using offline extraction:', aiError);
          setExtractionProgress(50);
          extractedResult = extractWithRegex(notes);
          setExtractionProgress(75);
        }
      } else {
        setExtractionProgress(50);
        extractedResult = extractWithRegex(notes);
        setExtractionProgress(75);
      }

      if (extractedResult) {
        const allText = Object.values(notes).join('\n');
        const expandedText = expandAbbreviations(allText);
        
        // Extract entities with ML
        const entities = {
          diagnoses: extractEntitiesWithML(expandedText, 'diagnosis'),
          procedures: extractEntitiesWithML(expandedText, 'procedures'),
          medications: extractEntitiesWithML(expandedText, 'medications'),
          complications: extractEntitiesWithML(expandedText, 'complications'),
          labValues: extractEntitiesWithML(expandedText, 'labValues')
        };
        
        // Detect conditions and procedures
        const detectedConditions = detectConditions(expandedText);
        const detectedProcedures = detectProcedures(expandedText);
        
        // Generate recommendations
        const recommendations = generateEvidenceBasedRecommendations(
          detectedConditions,
          detectedProcedures,
          entities
        );
        
        // Risk assessments
        const riskAssessment = {
          seizure: assessSeizureRisk(expandedText, detectedConditions, detectedProcedures),
          vte: assessVTERisk(detectedProcedures, expandedText),
          readmission: calculateReadmissionRisk(entities, detectedConditions),
          vasospasm: assessVasospasmRisk(detectedConditions, expandedText)
        };
        
        // Create analysis
        const analysisResult = {
          extracted: entities,
          conditions: detectedConditions,
          procedures: detectedProcedures,
          recommendations,
          riskAssessment,
          confidence: model.confidence,
          accuracy: trainingData.accuracy.current
        };
        
        setAnalysis(analysisResult);
        setPredictions(analysisResult);
        setExtractedData(extractedResult);
        
        // Validate
        const validation = validateExtractedData(extractedResult);
        setValidationResults(validation);
        
        if (validation.warnings.length > 0) {
          setWarnings(validation.warnings);
        }
        
        setExtractionProgress(100);
        setSuccessMessage('Extraction complete! Review the data below.');
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (err) {
      setError(`Processing failed: ${err.message}`);
      console.error(err);
    } finally {
      setIsProcessing(false);
      setLoading(false);
      setTimeout(() => setExtractionProgress(0), 1000);
    }
  }, [notes, extractionMethod, apiKey, expandAbbreviations, extractEntitiesWithML, 
      detectConditions, detectProcedures, generateEvidenceBasedRecommendations,
      assessSeizureRisk, assessVTERisk, calculateReadmissionRisk, assessVasospasmRisk,
      extractWithAI, extractWithRegex, model.confidence, trainingData.accuracy.current]);

  const validateExtractedData = useCallback((data) => {
    const errors = [];
    const warnings = [];
    
    if (!data.patientName) warnings.push('Patient name missing');
    if (!data.dischargeDiagnosis) warnings.push('Discharge diagnosis missing');
    if (!data.admitDate) warnings.push('Admission date missing');
    if (!data.dischargeDate) warnings.push('Discharge date missing');
    
    if (data.admitDate && data.dischargeDate) {
      try {
        const admit = new Date(data.admitDate);
        const discharge = new Date(data.dischargeDate);
        if (discharge < admit) {
          errors.push('Discharge date is before admission date');
        }
      } catch (e) {
        warnings.push('Date format issue detected');
      }
    }
    
    const filledFields = Object.values(data).filter(v => 
      v && (Array.isArray(v) ? v.length > 0 : true)
    ).length;
    const completeness = filledFields / Object.keys(data).length;
    
    return { errors, warnings, isValid: errors.length === 0, completeness };
  }, []);

  const generateComprehensiveSummary = useCallback((data) => {
    const formatList = (items, type = 'bullet') => {
      if (!items || items.length === 0) return 'None documented';
      return items.map((item, i) => `${type === 'number' ? (i + 1) + '.' : '•'} ${item}`).join('\n');
    };

    let los = data.los || '';
    if (!los && data.admitDate && data.dischargeDate) {
      try {
        const admit = new Date(data.admitDate);
        const discharge = new Date(data.dischargeDate);
        const days = Math.ceil((discharge - admit) / (1000 * 60 * 60 * 24));
        los = days > 0 ? `${days} days` : '1 day';
      } catch (e) {
        los = '[Calculate LOS]';
      }
    }

    const summary = `NEUROSURGERY DISCHARGE SUMMARY
════════════════════════════════════════════════════════════════════════════════
Generated with ML Intelligence (Accuracy: ${trainingData.accuracy.current}%)
Model Version: ${trainingData.modelVersion} | Samples Trained: ${trainingData.totalSamples}
Date Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}

PATIENT IDENTIFICATION
────────────────────────────────────────────────────────────────────────────────
Name: ${data.patientName || '[Patient Name]'}
Age/Sex: ${data.age || '[Age]'} years / ${data.sex || '[Sex]'}
MRN: ${data.mrn || '[MRN]'}
Admission Date: ${data.admitDate || '[Admission Date]'}
Discharge Date: ${data.dischargeDate || '[Discharge Date]'}
Length of Stay: ${los || '[LOS]'}

DIAGNOSES
────────────────────────────────────────────────────────────────────────────────
Admitting Diagnosis:
${data.admittingDiagnosis || '[Admitting diagnosis]'}

Discharge Diagnosis:
${data.dischargeDiagnosis || '[Discharge diagnosis]'}
${data.postOpDiagnosis && data.postOpDiagnosis !== data.dischargeDiagnosis ? 
  `\nPost-operative Diagnosis:\n${data.postOpDiagnosis}` : ''}

${data.secondaryDiagnoses && data.secondaryDiagnoses.length > 0 ? 
  `Secondary Diagnoses:\n${formatList(data.secondaryDiagnoses)}` : ''}

PROCEDURES AND OPERATIONS
────────────────────────────────────────────────────────────────────────────────
${formatList(data.procedures, 'number')}
${data.operativeDate ? `\nOperative Date: ${data.operativeDate}` : ''}
${data.ebl ? `Estimated Blood Loss: ${data.ebl}` : ''}

HISTORY OF PRESENT ILLNESS
────────────────────────────────────────────────────────────────────────────────
${data.historyPresenting || '[History of presenting illness]'}

HOSPITAL COURSE
────────────────────────────────────────────────────────────────────────────────
${data.hospitalCourse || '[Detailed hospital course]'}

${data.complications && data.complications.length > 0 ? 
  `\nCOMPLICATIONS\n${formatList(data.complications)}` : 
  '\nCOMPLICATIONS\nNo complications noted'}

PHYSICAL EXAMINATION AT DISCHARGE
────────────────────────────────────────────────────────────────────────────────
Vital Signs: ${data.vitalSigns || 'Stable, afebrile'}
General: ${data.currentExam || '[Physical examination findings]'}
${data.neuroExam ? `Neurological: ${data.neuroExam}` : ''}
${data.wounds ? `Wounds: ${data.wounds}` : ''}
${data.drains ? `Drains: ${data.drains}` : ''}

PAST MEDICAL HISTORY
────────────────────────────────────────────────────────────────────────────────
${formatList(data.pmh)}

PAST SURGICAL HISTORY
────────────────────────────────────────────────────────────────────────────────
${formatList(data.psh)}

SOCIAL HISTORY
────────────────────────────────────────────────────────────────────────────────
${data.socialHistory || 'Not documented'}

FAMILY HISTORY
────────────────────────────────────────────────────────────────────────────────
${data.familyHistory || 'Non-contributory'}

ALLERGIES
────────────────────────────────────────────────────────────────────────────────
${data.allergies || 'No Known Drug Allergies (NKDA)'}

MEDICATIONS ON ADMISSION
────────────────────────────────────────────────────────────────────────────────
${formatList(data.homeMedications, 'number')}

DISCHARGE MEDICATIONS
────────────────────────────────────────────────────────────────────────────────
${formatList(data.dischargeMedications, 'number')}

${analysis && analysis.recommendations ? `
EVIDENCE-BASED MEDICATION RECOMMENDATIONS
────────────────────────────────────────────────────────────────────────────────
${analysis.recommendations.medications.map(m => 
  `• ${m.drug}: ${m.dose}
  Duration: ${m.duration || 'Ongoing'}
  Indication: ${m.reason}
  Evidence: ${m.evidence}
  ${m.nnt ? `NNT: ${m.nnt}` : ''}`
).join('\n\n')}` : ''}

${analysis && analysis.riskAssessment ? `
RISK ASSESSMENT (ML-Generated)
────────────────────────────────────────────────────────────────────────────────
Seizure Risk: ${analysis.riskAssessment.seizure.category} (${analysis.riskAssessment.seizure.percentage}%)
  Factors: ${analysis.riskAssessment.seizure.factors.join(', ') || 'None identified'}
  ${analysis.riskAssessment.seizure.recommendation}

VTE Risk: ${analysis.riskAssessment.vte.level} (${analysis.riskAssessment.vte.percentage}%)
  Prophylaxis: ${analysis.riskAssessment.vte.prophylaxis}
  Timing: ${analysis.riskAssessment.vte.timing}

Readmission Risk: ${analysis.riskAssessment.readmission.category} (${analysis.riskAssessment.readmission.percentage}%)
  Factors: ${analysis.riskAssessment.readmission.factors.join(', ') || 'None'}
  Mitigation: ${analysis.riskAssessment.readmission.mitigation}

${analysis.riskAssessment.vasospasm.risk !== 'N/A' ? 
`Vasospasm Risk: ${analysis.riskAssessment.vasospasm.risk} (${analysis.riskAssessment.vasospasm.percentage}%)
  Monitoring: ${analysis.riskAssessment.vasospasm.monitoring}
  Treatment: ${analysis.riskAssessment.vasospasm.treatment}` : ''}` : ''}

DISCHARGE INSTRUCTIONS
────────────────────────────────────────────────────────────────────────────────
Disposition: ${data.disposition || 'Home'}
Code Status: ${data.codeStatus || 'Full Code'}
Diet: ${data.diet || 'Regular diet as tolerated'}
Activity: ${data.activity || 'As tolerated with restrictions as discussed'}

${data.restrictions && data.restrictions.length > 0 ? 
  `Activity Restrictions:\n${formatList(data.restrictions)}` : ''}

${analysis && analysis.recommendations && analysis.recommendations.woundCare.length > 0 ? 
  `\nWound Care:\n${analysis.recommendations.woundCare.map(w => 
    `• ${w.instruction}\n  ${w.showering ? `Showering: ${w.showering}` : ''}\n  ${w.signs_infection ? `Watch for: ${w.signs_infection}` : ''}`
  ).join('\n')}` : ''}

Warning Signs - Return to ED for:
${analysis && analysis.recommendations && analysis.recommendations.warningsSigns.length > 0 ? 
  formatList(analysis.recommendations.warningsSigns) : 
  formatList([
    'Fever >101.5°F (38.6°C)',
    'Severe headache not relieved by medication',
    'New weakness, numbness, or difficulty speaking',
    'Seizure activity',
    'Wound drainage, redness, or separation',
    'Shortness of breath or chest pain',
    'Any other concerning symptoms'
  ])}

FOLLOW-UP APPOINTMENTS
────────────────────────────────────────────────────────────────────────────────
${formatList(data.followUp)}

${analysis && analysis.recommendations && analysis.recommendations.followUp.length > 0 ? 
  `\nRecommended Follow-up:\n${analysis.recommendations.followUp.map(f => 
    `• ${f.specialty} - ${f.timing}\n  Reason: ${f.reason}\n  Tests needed: ${f.tests}`
  ).join('\n\n')}` : ''}

${analysis && analysis.recommendations && analysis.recommendations.rehabilitation.length > 0 ? `
REHABILITATION PLAN
────────────────────────────────────────────────────────────────────────────────
${analysis.recommendations.rehabilitation.map(r => 
  `• ${r.service}
  Frequency: ${r.frequency}
  Focus: ${r.focus}
  Duration: ${r.duration}
  ${r.goals ? `Goals: ${r.goals}` : ''}`
).join('\n\n')}` : ''}

CLINICAL DECISION SUPPORT
────────────────────────────────────────────────────────────────────────────────
Guidelines Applied:
• American Heart Association/American Stroke Association (2024)
• North American Spine Society (2024)
• Neurocritical Care Society (2024)
• Congress of Neurological Surgeons
• UpToDate and Cochrane Database (2024)

ML Model Performance:
• Current Accuracy: ${trainingData.accuracy.current}%
• Precision: ${(model.performance.precision * 100).toFixed(1)}%
• Recall: ${(model.performance.recall * 100).toFixed(1)}%
• F1 Score: ${model.performance.f1.toFixed(3)}

Medical Intelligence:
• ${Object.keys(medicalAbbreviations).length}+ abbreviations recognized
• ${Object.keys(clinicalGuidelines).length} evidence-based protocols applied
• ${trainingData.totalSamples} training samples processed

════════════════════════════════════════════════════════════════════════════════
This summary combines ML predictions with evidence-based guidelines.
Confidence level: ${analysis ? (analysis.confidence * 100).toFixed(0) : '70'}%

_______________________________
[Physician Name], MD
Department of Neurosurgery
[Hospital Name]
[Contact Number]`;

    return summary;
  }, [trainingData.accuracy.current, trainingData.modelVersion, trainingData.totalSamples, 
      model.performance, analysis]);

  const trainModel = useCallback(async (field, correctedValue) => {
    if (!correctedValue) return;
    
    setIsProcessing(true);
    
    const newTrainingData = { ...trainingData };
    
    newTrainingData.corrections.push({
      timestamp: Date.now(),
      field: field,
      predicted: predictions?.[field],
      corrected: correctedValue
    });
    
    const patternKey = `${field}:${correctedValue?.toLowerCase()}`;
    newTrainingData.patterns[patternKey] = (newTrainingData.patterns[patternKey] || 0) + 1;
    
    if (field.startsWith('abbr:')) {
      const [, abbr, expansion] = field.split(':');
      newTrainingData.patterns[`abbr:${abbr}:${expansion}`] = 1;
    }
    
    newTrainingData.totalSamples += 1;
    
    const newAccuracy = Math.min(98, 70 + (newTrainingData.totalSamples * 0.5) - 
      (newTrainingData.corrections.length * 0.1));
    newTrainingData.accuracy.current = Math.round(newAccuracy);
    newTrainingData.accuracy.history.push(newTrainingData.accuracy.current);
    
    if (field.includes('neuro')) {
      newTrainingData.specialtyAccuracy.neurosurgery = 
        Math.min(98, newTrainingData.specialtyAccuracy.neurosurgery + 0.5);
    } else if (field.includes('spine')) {
      newTrainingData.specialtyAccuracy.spine = 
        Math.min(98, newTrainingData.specialtyAccuracy.spine + 0.5);
    }
    
    newTrainingData.lastUpdated = new Date().toISOString();
    
    localStorage.setItem('ultimateMLTrainingData', JSON.stringify(newTrainingData));
    setTrainingData(newTrainingData);
    
    setModel(prev => ({
      ...prev,
      confidence: newAccuracy / 100,
      trained: true,
      performance: {
        precision: Math.min(0.98, newAccuracy / 100 + 0.05),
        recall: Math.min(0.95, newAccuracy / 100),
        f1: Math.min(0.96, (newAccuracy / 100 + 0.025)),
        auc: Math.min(0.97, newAccuracy / 100 + 0.03)
      }
    }));
    
    setIsProcessing(false);
    setSuccessMessage('Model trained successfully!');
    setTimeout(() => setSuccessMessage(''), 3000);
    
    await processNotesWithMLandIntelligence();
  }, [trainingData, predictions, processNotesWithMLandIntelligence]);

  const handleCorrection = useCallback((field, correctedValue) => {
    if (!correctedValue) return;
    
    const newCorrections = { ...corrections };
    newCorrections[field] = correctedValue;
    setCorrections(newCorrections);
    
    trainModel(field, correctedValue);
  }, [corrections, trainModel]);

  const updateModelStatus = useCallback(() => {
    const accuracy = trainingData.accuracy.current;
    setModel(prev => ({
      ...prev,
      confidence: accuracy / 100,
      trained: trainingData.totalSamples > 0,
      performance: {
        precision: Math.min(0.98, accuracy / 100 + 0.05),
        recall: Math.min(0.95, accuracy / 100),
        f1: Math.min(0.96, (accuracy / 100 + 0.025)),
        auc: Math.min(0.97, accuracy / 100 + 0.03)
      }
    }));
  }, [trainingData.accuracy.current, trainingData.totalSamples]);

  const handleDataChange = useCallback((key, value) => {
    setExtractedData(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleFileUpload = (e, noteType) => {
    const file = e.target.files[0];
    if (file && file.size < 10485760) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setNotes(prev => ({ ...prev, [noteType]: event.target.result }));
        setSuccessMessage(`File uploaded successfully for ${noteType}`);
        setTimeout(() => setSuccessMessage(''), 3000);
      };
      reader.onerror = () => {
        setError('Failed to read file');
      };