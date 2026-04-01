/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { Share2, CheckCircle2, ArrowRight, RefreshCw, Trophy, User, Copy, Check, BookOpen, Star } from 'lucide-react';
import confetti from 'canvas-confetti';

const QUESTIONS_DATA = [
  { text: "What is my favorite hobby?", choices: ["Reading", "Sports", "Playing video games", "Traveling"] },
  { text: "What kind of music do I like the most?", choices: ["Pop", "Rock", "Hip-Hop / Rap", "Classical"] },
  { text: "What is my favorite food?", choices: ["Pizza", "Sushi", "Burgers", "Salad"] },
  { text: "How do I usually spend my weekends?", choices: ["Hanging out with friends", "Studying or working", "Playing games / watching shows", "Exercising or outdoor activities"] },
  { text: "Which quality do I value the most in a friend?", choices: ["Honesty", "Humor", "Loyalty", "Creativity"] },
  { text: "What is my dream travel destination?", choices: ["Beach resort", "Big city", "Mountains / Hiking", "Historical sites"] },
  { text: "How do I handle stress?", choices: ["Talk to friends / family", "Exercise", "Watch TV / Play games", "Stay alone and reflect"] },
  { text: "What is my favorite type of movie?", choices: ["Comedy", "Action / Adventure", "Horror / Thriller", "Romance / Drama"] },
  { text: "Which of these is my favorite season?", choices: ["Spring", "Summer", "Fall", "Winter"] },
  { text: "What motivates me the most?", choices: ["Achieving goals", "Helping others", "Learning new things", "Having fun / relaxing"] },
];

export default function App() {
  const [mode, setMode] = useState<'creator' | 'player' | 'landing' | 'success'>('landing');
  const [quizId, setQuizId] = useState<string | null>(null);
  const [creatorAnswers, setCreatorAnswers] = useState<Record<number, string>>({});
  const [playerAnswers, setPlayerAnswers] = useState<Record<number, string>>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [score, setScore] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [otherValue, setOtherValue] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [creatorName, setCreatorName] = useState('');
  const [hasStarted, setHasStarted] = useState(false);
  const [creatorNameStep, setCreatorNameStep] = useState(false);

  useEffect(() => {
    // Reset "Other" state when moving between questions
    if (mode === 'creator') {
      const currentAnswer = creatorAnswers[currentStep];
      const isStandard = QUESTIONS_DATA[currentStep].choices.includes(currentAnswer);
      if (currentAnswer && !isStandard) {
        setShowOtherInput(true);
        setOtherValue(currentAnswer);
      } else {
        setShowOtherInput(false);
        setOtherValue('');
      }
    }
  }, [currentStep, mode]);
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const qId = urlParams.get('quiz');
    if (qId) {
      setQuizId(qId);
      setMode('player');
      loadCreatorAnswers(qId);
    } else {
      setMode('landing');
      setLoading(false);
    }
  }, []);

  const loadCreatorAnswers = async (id: string) => {
    try {
      setLoading(true);
      
      // 1. Load quiz details (for creator name)
      const { data: quizData, error: qErr } = await supabase
        .from('quizzes')
        .select('title')
        .eq('quiz_id', id)
        .single();
      
      if (qErr) throw qErr;
      if (quizData) setCreatorName(quizData.title);

      // 2. Load creator answers
      const { data, error } = await supabase
        .from('creator_answers')
        .select('*')
        .eq('quiz_id', id);

      if (error) throw error;
      
      const answers: Record<number, string> = {};
      data.forEach((ans: any) => {
        answers[ans.question_order] = ans.answer_text;
      });
      setCreatorAnswers(answers);
    } catch (e) {
      console.error('Error loading answers:', e);
      alert('Could not load quiz. It might not exist.');
      setMode('landing');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQuiz = async () => {
    if (Object.keys(creatorAnswers).length < QUESTIONS_DATA.length) {
      alert("Please answer all questions first!");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create Quiz
      const { data: quiz, error: qErr } = await supabase
        .from('quizzes')
        .insert([{ title: creatorName || 'Someone' }])
        .select()
        .single();

      if (qErr) throw qErr;

      // 2. Save creator answers
      const answersToInsert = QUESTIONS_DATA.map((_, i) => ({
        quiz_id: quiz.quiz_id,
        answer_text: creatorAnswers[i],
        question_order: i
      }));

      const { error: aErr } = await supabase.from('creator_answers').insert(answersToInsert);
      if (aErr) throw aErr;

      let baseUrl = process.env.SHARED_APP_URL || window.location.origin;
      
      // Fallback: If we are in dev mode, try to convert to pre (shared) URL
      if (baseUrl.includes('ais-dev-')) {
        baseUrl = baseUrl.replace('ais-dev-', 'ais-pre-');
      }
      
      const url = `${baseUrl}?quiz=${quiz.quiz_id}`;
      setShareUrl(url);
      setMode('success');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePlayerSubmit = async () => {
    if (Object.keys(playerAnswers).length < QUESTIONS_DATA.length) {
      alert("Please answer all questions!");
      return;
    }

    let correctCount = 0;
    QUESTIONS_DATA.forEach((_, i) => {
      if (playerAnswers[i] === creatorAnswers[i]) {
        correctCount++;
      }
    });

    setScore(correctCount);

    // Trigger confetti for high scores (70% or more)
    if (correctCount / QUESTIONS_DATA.length >= 0.7) {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#ea580c', '#f97316', '#fb923c', '#fdba74']
      });
    }

    // Save score to database
    if (quizId) {
      try {
        await supabase.from('scores').insert([{
          quiz_id: quizId,
          player_name: playerName || 'Anonymous',
          score_value: correctCount
        }]);
      } catch (e) {
        console.error('Error saving score:', e);
      }
    }
  };

  const handleShare = async () => {
    const text = mode === 'success' 
      ? 'Can you beat my score? Take my "Know Me" quiz!' 
      : `I just scored ${score}/${QUESTIONS_DATA.length} on ${creatorName || 'this'}'s "Know Me" quiz! Can you beat me?`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Know Me Quiz',
          text: text,
          url: shareUrl || window.location.href,
        });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          copyToClipboard(text);
        }
      }
    } else {
      copyToClipboard(text);
    }
  };

  const copyToClipboard = (text?: string) => {
    const content = text ? `${text} ${shareUrl || window.location.href}` : (shareUrl || window.location.href);
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans selection:bg-orange-100">
      <div className="max-w-xl mx-auto px-6 py-12">
        
        {/* Header */}
        <header className="text-center mb-12">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-bold tracking-tight mb-2"
          >
            Know Me Quiz
          </motion.h1>
          <p className="text-zinc-500 italic">
            {mode === 'player' && creatorName 
              ? `How well do you know ${creatorName}?` 
              : "How well do people really know you?"}
          </p>
        </header>

        <main>
          <AnimatePresence mode="wait">
            {/* Landing / Success State */}
            {mode === 'landing' && currentStep === 0 && (
              <motion.div 
                key="landing"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white p-8 rounded-3xl shadow-sm border border-zinc-100 text-center"
              >
                <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <User className="w-8 h-8 text-orange-600" />
                </div>
                <h2 className="text-2xl font-semibold mb-4">Create Your Quiz</h2>
                <p className="text-zinc-600 mb-8">
                  Answer 10 questions about yourself, then share the link with others to see who knows you best!
                </p>
                <button 
                  onClick={() => { setMode('creator'); setCurrentStep(0); }}
                  className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-medium hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2"
                >
                  Get Started <ArrowRight className="w-4 h-4" />
                </button>
              </motion.div>
            )}

            {/* Success State */}
            {mode === 'success' && (
              <motion.div 
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white p-10 rounded-[2rem] shadow-2xl shadow-zinc-200/50 border border-zinc-100 text-center relative overflow-hidden"
              >
                <div className="absolute inset-0 opacity-[0.02] pointer-events-none">
                  <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
                </div>

                <div className="relative z-10">
                  <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner border border-green-100">
                    <CheckCircle2 className="w-10 h-10 text-green-600" />
                  </div>
                  
                  <div className="mb-2">
                    <span className="text-[10px] font-black text-green-600 uppercase tracking-[0.3em] bg-green-50 px-3 py-1 rounded-full border border-green-100">
                      Success
                    </span>
                  </div>

                  <h2 className="text-4xl font-black text-zinc-900 mb-4 tracking-tight">Quiz Created!</h2>
                  <p className="text-zinc-500 text-lg mb-10 font-medium">Share this link with others to start the challenge.</p>
                  
                  <div className="flex flex-col gap-4 mb-10">
                    <div className="flex items-center gap-3 p-5 bg-zinc-50 rounded-2xl border border-zinc-100 shadow-inner group">
                      <input 
                        readOnly 
                        value={shareUrl} 
                        className="bg-transparent flex-1 text-sm font-mono text-zinc-500 outline-none select-all"
                      />
                      <button 
                        onClick={() => copyToClipboard()}
                        className="p-2.5 bg-white hover:bg-zinc-100 rounded-xl transition-all shadow-sm border border-zinc-100"
                        title="Copy to clipboard"
                      >
                        {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-zinc-400" />}
                      </button>
                    </div>
                    
                    <button 
                      onClick={handleShare}
                      className={`w-full py-5 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-xl ${
                        copied 
                          ? 'bg-green-600 text-white shadow-green-200' 
                          : 'bg-zinc-900 text-white shadow-zinc-200 hover:bg-zinc-800'
                      }`}
                    >
                      {copied ? (
                        <><Check className="w-5 h-5" /> Copied!</>
                      ) : (
                        <><Share2 className="w-5 h-5" /> Share Quiz Link</>
                      )}
                    </button>
                  </div>

                  <button 
                    onClick={() => window.location.href = '/'}
                    className="w-full py-4 bg-zinc-100 text-zinc-600 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-zinc-200 transition-all"
                  >
                    Create Another
                  </button>
                </div>
              </motion.div>
            )}

            {/* Player Name Input State */}
            {mode === 'player' && !hasStarted && (
              <motion.div 
                key="player-name"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white p-8 rounded-3xl shadow-sm border border-zinc-100 text-center"
              >
                <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <User className="w-8 h-8 text-orange-600" />
                </div>
                <h2 className="text-2xl font-semibold mb-4">Ready to play?</h2>
                <p className="text-zinc-600 mb-8">Enter your name or nickname to start the quiz!</p>
                
                <input 
                  type="text"
                  placeholder="Your Name"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className="w-full p-4 bg-zinc-50 rounded-2xl border border-zinc-200 mb-6 text-center text-lg font-medium outline-none focus:border-orange-500 transition-colors"
                  autoFocus
                />

                <button 
                  disabled={!playerName.trim()}
                  onClick={() => setHasStarted(true)}
                  className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-medium hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  Start Quiz <ArrowRight className="w-4 h-4" />
                </button>
              </motion.div>
            )}

            {/* Creator Name Input State */}
            {mode === 'creator' && !creatorNameStep && (
              <motion.div 
                key="creator-name"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white p-8 rounded-3xl shadow-sm border border-zinc-100 text-center"
              >
                <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <User className="w-8 h-8 text-orange-600" />
                </div>
                <h2 className="text-2xl font-semibold mb-4">What's your name?</h2>
                <p className="text-zinc-600 mb-8">Enter a name or nickname that people know you by!</p>
                
                <input 
                  type="text"
                  placeholder="Your Name"
                  value={creatorName}
                  onChange={(e) => setCreatorName(e.target.value)}
                  className="w-full p-4 bg-zinc-50 rounded-2xl border border-zinc-200 mb-6 text-center text-lg font-medium outline-none focus:border-orange-500 transition-colors"
                  autoFocus
                />

                <button 
                  disabled={!creatorName.trim()}
                  onClick={() => setCreatorNameStep(true)}
                  className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-medium hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  Continue <ArrowRight className="w-4 h-4" />
                </button>
              </motion.div>
            )}

            {/* Creator / Player Quiz Flow */}
            {((mode === 'creator' && creatorNameStep) || (mode === 'player' && hasStarted)) && currentStep < QUESTIONS_DATA.length && score === null && (
              <motion.div 
                key={`q-${currentStep}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white p-8 rounded-3xl shadow-sm border border-zinc-100"
              >
                <div className="flex justify-between items-center mb-8">
                  <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                    Question {currentStep + 1} of {QUESTIONS_DATA.length}
                  </span>
                  <div className="h-1 w-24 bg-zinc-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-orange-500 transition-all duration-300" 
                      style={{ width: `${((currentStep + 1) / QUESTIONS_DATA.length) * 100}%` }}
                    />
                  </div>
                </div>

                {mode === 'player' && currentStep === 0 && (
                  <p className="text-orange-600 font-medium mb-4 text-center">
                    Take this to see how do you know me
                  </p>
                )}

                <h2 className="text-2xl font-semibold mb-8 leading-tight">
                  {mode === 'creator' 
                    ? QUESTIONS_DATA[currentStep].text
                        .replace(/\bmy\b/gi, 'your')
                        .replace(/\bI\b/g, 'you')
                        .replace(/\bme\b/gi, 'you')
                    : QUESTIONS_DATA[currentStep].text
                  }
                </h2>

                <div className="space-y-3 mb-8">
                  {(() => {
                    const defaultChoices = QUESTIONS_DATA[currentStep].choices;
                    const correctAnswer = creatorAnswers[currentStep];
                    const isCustomAnswer = correctAnswer && !defaultChoices.includes(correctAnswer);
                    
                    // For players, if there's a custom answer, add it to the choices
                    const displayChoices = (mode === 'player' && isCustomAnswer) 
                      ? [...defaultChoices, correctAnswer] 
                      : defaultChoices;

                    return displayChoices.map((choice) => {
                      const isSelected = (mode === 'creator' ? creatorAnswers[currentStep] : playerAnswers[currentStep]) === choice;
                      return (
                        <button
                          key={choice}
                          onClick={() => {
                            if (mode === 'creator') {
                              setShowOtherInput(false);
                              setCreatorAnswers({ ...creatorAnswers, [currentStep]: choice });
                            } else {
                              setPlayerAnswers({ ...playerAnswers, [currentStep]: choice });
                            }
                          }}
                          className={`w-full p-4 text-left rounded-2xl border transition-all ${
                            isSelected 
                              ? 'bg-zinc-900 border-zinc-900 text-white shadow-lg shadow-zinc-200' 
                              : 'bg-white border-zinc-200 hover:border-zinc-400 text-zinc-700'
                          }`}
                        >
                          {choice}
                        </button>
                      );
                    });
                  })()}

                  {mode === 'creator' && (
                    <div className="space-y-3">
                      <button
                        onClick={() => {
                          setShowOtherInput(true);
                          setCreatorAnswers({ ...creatorAnswers, [currentStep]: '' });
                        }}
                        className={`w-full p-4 text-left rounded-2xl border transition-all ${
                          showOtherInput 
                            ? 'bg-zinc-900 border-zinc-900 text-white shadow-lg shadow-zinc-200' 
                            : 'bg-white border-zinc-200 hover:border-zinc-400 text-zinc-700'
                        }`}
                      >
                        Other...
                      </button>
                      
                      {showOtherInput && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200"
                        >
                          <input
                            type="text"
                            placeholder="Type your custom answer..."
                            value={otherValue}
                            onChange={(e) => {
                              setOtherValue(e.target.value);
                              setCreatorAnswers({ ...creatorAnswers, [currentStep]: e.target.value });
                            }}
                            className="w-full bg-transparent border-none focus:ring-0 text-zinc-900 placeholder:text-zinc-400"
                            autoFocus
                          />
                        </motion.div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  {currentStep > 0 && (
                    <button 
                      onClick={() => setCurrentStep(currentStep - 1)}
                      className="px-6 py-4 bg-zinc-100 text-zinc-900 rounded-2xl font-medium hover:bg-zinc-200 transition-colors"
                    >
                      Back
                    </button>
                  )}
                  <button 
                    disabled={!(mode === 'creator' ? creatorAnswers[currentStep] : playerAnswers[currentStep])}
                    onClick={() => {
                      if (currentStep < QUESTIONS_DATA.length - 1) {
                        setCurrentStep(currentStep + 1);
                      } else {
                        if (mode === 'creator') handleCreateQuiz();
                        else handlePlayerSubmit();
                      }
                    }}
                    className="flex-1 py-4 bg-zinc-900 text-white rounded-2xl font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {currentStep === QUESTIONS_DATA.length - 1 
                      ? (isSubmitting ? 'Submitting...' : (mode === 'creator' ? 'Create' : 'Submit')) 
                      : 'Next'}
                  </button>
                </div>
              </motion.div>
            )}

            {/* Player Results */}
            {score !== null && (
              <div className="space-y-8">
                <motion.div 
                  key="results"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 }}
                  className="bg-white p-10 rounded-[2rem] shadow-xl shadow-zinc-200/50 border border-zinc-100 text-center relative overflow-hidden"
                >
                  {/* Subtle Background Pattern */}
                  <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
                    <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                  </div>

                  <div className="relative z-10">
                    <div className="mb-2">
                      <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em]">
                        Quiz Completed
                      </span>
                    </div>

                    <h2 className="text-4xl font-black text-zinc-900 mb-8 tracking-tight">
                      {playerName ? `${playerName}'s Score` : "Your Score"}
                    </h2>

                    <div className="relative inline-flex items-center justify-center mb-12">
                      <motion.div 
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", damping: 15, stiffness: 300, delay: 0.2 }}
                        className="relative z-10"
                      >
                        <Trophy className="w-20 h-20 text-yellow-400 mx-auto mb-4 drop-shadow-lg" />
                        <div className="text-8xl font-black text-zinc-900 leading-none flex items-baseline gap-1">
                          {score}
                          <span className="text-3xl text-zinc-300 font-medium">/{QUESTIONS_DATA.length}</span>
                        </div>
                      </motion.div>
                      
                      {/* Decorative elements */}
                      <div className="absolute -top-4 -right-4">
                        <Star className="w-6 h-6 text-yellow-400 fill-yellow-400 animate-pulse" />
                      </div>
                      <div className="absolute -bottom-2 -left-6">
                        <Star className="w-4 h-4 text-orange-400 fill-orange-400 animate-bounce" />
                      </div>
                    </div>

                    <div className="max-w-xs mx-auto mb-10">
                      <p className="text-zinc-500 text-lg leading-relaxed font-medium mb-6">
                        {score <= 2 ? "A fresh start! The best part of any relationship is the journey of discovery." : 
                         score <= 5 ? "Getting there! You've got the basics down, but there's still more to uncover." :
                         score <= 8 ? `Impressive! You clearly pay attention to the little things that matter to ${creatorName || 'them'}.` :
                         `Mind Reader! Your connection is truly exceptional. You know ${creatorName || 'them'} inside out.`}
                      </p>
                      
                      <motion.button
                        onClick={() => document.getElementById('recommendation-section')?.scrollIntoView({ behavior: 'smooth' })}
                        animate={{ y: [0, 5, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="text-orange-600 font-black text-xs uppercase tracking-[0.2em] flex items-center gap-2 mx-auto hover:text-orange-700 transition-colors"
                      >
                        View Recommendation <ArrowRight className="w-4 h-4 rotate-90" />
                      </motion.button>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-4">
                      <button 
                        onClick={handleShare}
                        className={`w-full py-5 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-xl ${
                          copied 
                            ? 'bg-green-600 text-white shadow-green-200' 
                            : 'bg-zinc-900 text-white shadow-zinc-200 hover:bg-zinc-800'
                        }`}
                      >
                        {copied ? (
                          <><Check className="w-5 h-5" /> Copied!</>
                        ) : (
                          <><Share2 className="w-5 h-5" /> Share My Score</>
                        )}
                      </button>
                      
                      <div className="flex gap-3">
                        <button 
                          onClick={() => window.location.href = '/'}
                          className="flex-1 py-4 bg-white text-zinc-900 border-2 border-zinc-100 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-zinc-50 transition-all"
                        >
                          Create yours
                        </button>
                        <button 
                          onClick={() => { setScore(null); setPlayerAnswers({}); setCurrentStep(0); }}
                          className="flex-1 py-4 bg-zinc-100 text-zinc-600 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-zinc-200 transition-all"
                        >
                          Try Again
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Affiliate Recommendation - Moved back to bottom */}
                <motion.div
                  id="recommendation-section"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-white p-8 rounded-[2rem] shadow-2xl shadow-orange-100/50 border border-orange-100 overflow-hidden text-center relative"
                >
                  {/* Subtle Glow Background */}
                  <div className="absolute -top-24 -right-24 w-48 h-48 bg-orange-50 rounded-full blur-3xl opacity-50"></div>
                  <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-orange-50 rounded-full blur-3xl opacity-50"></div>

                  <div className="relative z-10 flex flex-col items-center max-w-md mx-auto">
                    <div className="flex items-center justify-center gap-2 mb-6">
                      <span className="text-[10px] font-black text-orange-600 uppercase tracking-[0.3em] bg-orange-50 px-4 py-1.5 rounded-full border border-orange-100 shadow-sm">
                        Top Recommendation
                      </span>
                    </div>
                    
                    <h3 className="text-3xl font-black text-zinc-900 mb-4 tracking-tight leading-tight">
                      Want a Deeper Connection?
                    </h3>
                    
                    <p className="text-zinc-700 text-base mb-4 font-medium leading-relaxed italic">
                      "Strong relationships aren’t built by guessing. They’re built by understanding."
                    </p>
                    
                    <p className="text-zinc-500 text-sm mb-8 max-w-xs">
                      Discover the secret to understanding how your partner gives and receives love.
                    </p>
                    
                    <div className="flex flex-col items-center gap-6 w-full">
                      <div className="flex flex-col items-center">
                        <div className="flex text-yellow-400 text-lg mb-1 drop-shadow-sm">
                          ★★★★★
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-zinc-400 font-bold uppercase tracking-widest">"10+ Million Copies Sold"</span>
                          <span className="w-1 h-1 bg-zinc-300 rounded-full"></span>
                          <span className="text-[11px] text-orange-600 font-black uppercase tracking-widest">Bestseller</span>
                        </div>
                      </div>
                      
                      <motion.a 
                        href="https://amzn.to/4saNrlE" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        animate={{ scale: [1, 1.02, 1] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                        className="group relative inline-flex items-center justify-center px-10 py-5 bg-orange-600 text-white rounded-2xl font-black hover:bg-orange-700 transition-all text-lg shadow-xl shadow-orange-200 w-full overflow-hidden"
                      >
                        <span className="relative z-10 flex items-center gap-2">
                          Understand Them Better <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </span>
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                        
                        {/* Continuous shine animation */}
                        <motion.div 
                          animate={{ x: ['100%', '-100%'] }}
                          transition={{ duration: 3, repeat: Infinity, ease: "linear", repeatDelay: 1 }}
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent w-1/2 -skew-x-12"
                        />
                      </motion.a>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </main>

        <footer className="mt-12 text-center text-zinc-400 text-xs uppercase tracking-widest">
          &copy; 2026 Know Me Quiz
        </footer>
      </div>
    </div>
  );
}
