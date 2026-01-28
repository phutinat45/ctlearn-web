import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import confetti from 'canvas-confetti';
import Swal from 'sweetalert2';

const AUDIO_SRC = {
  bgm: "/sounds/bgm.mp3",          
  countdown: "/sounds/countdown.mp3", 
  correct: "/sounds/correct.mp3",     
  wrong: "/sounds/wrong.mp3",
  success: "/sounds/success.mp3", 
  fail: "/sounds/fail.mp3"        
};

function Quiz() {
  const { id } = useParams();
  const navigate = useNavigate();

  // --- State ข้อมูล ---
  const [lesson, setLesson] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- State เกม ---
  const [gameState, setGameState] = useState('ready'); 
  const [startCountdown, setStartCountdown] = useState(3);
  const [isMuted, setIsMuted] = useState(false);

  // --- State ข้อสอบ ---
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(null);
  const [isPassed, setIsPassed] = useState(false);

  // --- Audio Refs ---
  const bgmRef = useRef(new Audio(AUDIO_SRC.bgm)); // ✅ สร้างตั้งแต่แรกเลย
  const endGameRef = useRef(null);

  // Helper Playing Sound (Effect)
  const playSound = (type) => {
    if (isMuted) return;
    const audio = new Audio(AUDIO_SRC[type]);
    audio.volume = 0.6; // เพิ่มเสียง Effect ให้ชัดหน่อย
    audio.play().catch(e => console.warn("SFX Error:", e));
  };

  // Helper หยุดเสียงทั้งหมด
  const stopAllSounds = () => {
    // หยุด BGM
    if (bgmRef.current) {
        bgmRef.current.pause();
        bgmRef.current.currentTime = 0;
    }
    // หยุดเสียงจบเกม
    if (endGameRef.current) {
        endGameRef.current.pause();
        endGameRef.current.currentTime = 0;
    }
  };

  const formatTime = (seconds) => {
    if (seconds === null) return "--:--";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // 1. Init & Fetch Data
  useEffect(() => {
    // ✅ ตั้งค่า BGM ให้วนซ้ำ (Loop) แน่นอน 100%
    bgmRef.current.src = AUDIO_SRC.bgm;
    bgmRef.current.loop = true;  
    bgmRef.current.volume = 0.3; // เสียงเพลงเบาๆ (30%)

    const fetchQuizData = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('lessons')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        setLesson(data);
        
        const durationStr = data.duration || "15";
        const minutes = parseInt(durationStr.replace(/\D/g, '')) || 15; 
        setTimeLeft(minutes * 60);

        if (data.quiz && Array.isArray(data.quiz)) {
           const formatted = data.quiz.map(q => ({
               question: q.question || q.questionText,
               image: q.image || null,
               options: q.options || q.answerOptions.map(o => o.answerText),
               correctAnswer: q.correct !== undefined ? q.correct : q.answerOptions.findIndex(o => o.isCorrect) 
           }));
           setQuestions(formatted);
        }
      } catch (error) { console.error('Error:', error); } 
      finally { setLoading(false); }
    };
    fetchQuizData();

    // Cleanup: หยุดเสียงเมื่อออกจากหน้านี้
    return () => {
        stopAllSounds();
    };
  }, [id]);

  // 2. Start Game (จุดสำคัญ: สั่งเล่นเพลงตรงนี้)
  const handleStartGame = () => {
    if (!isMuted) {
        // ✅ บังคับเล่น BGM ทันทีที่กดปุ่ม
        bgmRef.current.play()
            .then(() => {
                console.log("BGM Started playing loop");
            })
            .catch(e => console.log("BGM Blocked:", e));
            
        playSound('countdown');
    }
    setGameState('countdown');
  };

  // 3. Countdown Logic
  useEffect(() => {
    if (gameState === 'countdown') {
        const timer = setInterval(() => {
            setStartCountdown((prev) => {
                if (prev === 1) {
                    clearInterval(timer);
                    setGameState('playing'); 
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }
  }, [gameState]);

  // 4. Timer Logic
  useEffect(() => {
    if (gameState !== 'playing' || timeLeft === null) return;
    if (timeLeft === 0) { finishQuiz(score); return; }

    const timer = setInterval(() => {
        setTimeLeft(prev => prev > 0 ? prev - 1 : 0);
    }, 1000);
    return () => clearInterval(timer);
  }, [gameState, timeLeft, score]);

  // 5. Check Answer
  const handleAnswer = (optionIndex) => {
    const currentQ = questions[currentQuestion];
    const isCorrect = optionIndex === currentQ.correctAnswer;

    if (isCorrect) {
        playSound('correct');
        Swal.fire({ icon: 'success', title: 'ถูกต้อง! 🎉', timer: 600, showConfirmButton: false, backdrop: `rgba(0,0,0,0.1)`, width: 300 });
    } else {
        playSound('wrong');
        Swal.fire({ icon: 'error', title: 'ผิดครับ 😅', timer: 600, showConfirmButton: false, backdrop: `rgba(0,0,0,0.1)`, width: 300 });
    }

    if (isCorrect) setScore(prev => prev + 1);

    setTimeout(() => {
      const nextQ = currentQuestion + 1;
      if (nextQ < questions.length) {
        setCurrentQuestion(nextQ);
      } else {
        finishQuiz(isCorrect ? score + 1 : score);
      }
    }, 800);
  };

  // 6. Finish Logic
  const finishQuiz = async (finalScore) => {
    setGameState('finished');
    
    // ✅ หยุด BGM เมื่อจบเกม (เพื่อให้เสียง Win/Fail เด่นขึ้น)
    if (bgmRef.current) {
        bgmRef.current.pause();
    }

    const passed = finalScore >= (questions.length / 2);
    setIsPassed(passed);

    if (!isMuted) {
        const endAudio = new Audio(passed ? AUDIO_SRC.success : AUDIO_SRC.fail);
        endAudio.volume = 0.6;
        endAudio.play().catch(e => console.warn("End sound error:", e));
        endGameRef.current = endAudio;
    }

    if (passed) fireConfetti();

    try {
        const userStr = localStorage.getItem('currentUser');
        if (userStr) {
            const user = JSON.parse(userStr);
            const { data: existing } = await supabase.from('progress').select('*').eq('student_id', user.id).eq('lesson_id', id).single();
            
            if (existing) {
                await supabase.from('progress').update({ passed: passed || existing.passed, score: finalScore }).eq('id', existing.id);
            } else {
                await supabase.from('progress').insert({ student_id: user.id, lesson_id: id, passed: passed, score: finalScore });
            }
            if (passed && (!existing || !existing.passed)) window.dispatchEvent(new Event('xp-updated'));
        }
    } catch (err) { console.error(err); }
  };

  const handleRetry = () => { stopAllSounds(); window.location.reload(); };
  const handleBack = () => { stopAllSounds(); navigate('/lessons'); };
  
  const fireConfetti = () => {
    const duration = 3000;
    const end = Date.now() + duration;
    (function frame() {
      confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#22c55e', '#eab308'] });
      confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#22c55e', '#eab308'] });
      if (Date.now() < end) requestAnimationFrame(frame);
    }());
  };

  const toggleMute = () => {
      setIsMuted(prev => {
          const newState = !prev;
          if (newState) { 
             stopAllSounds(); // ปิดเสียง -> หยุดทุกอย่าง
          } else { 
             // เปิดเสียง -> ถ้าอยู่ในหน้าเล่นเกม ให้เล่นเพลงต่อ
             if((gameState === 'playing' || gameState === 'countdown') && bgmRef.current) {
                 bgmRef.current.play().catch(() => {});
             }
          }
          return newState;
      });
  };

  // --- UI ---
  if (loading) return <div style={{textAlign:'center', marginTop:'100px'}}>กำลังโหลดข้อสอบ...</div>;
  if (!questions.length) return <div style={{textAlign:'center', marginTop:'100px'}}>ไม่พบข้อสอบ</div>;

  // Ready Screen
  if (gameState === 'ready') {
      return (
        <div style={{ textAlign: 'center', padding: '100px 20px', minHeight: '100vh', background: '#f8fafc' }}>
            <h1 style={{ fontSize: '3rem', color: '#1e293b', marginBottom: '10px' }}>{lesson?.title}</h1>
            <p style={{ color: '#64748b', fontSize: '1.2rem', marginBottom: '40px' }}>แบบทดสอบท้ายบทเรียน</p>
            <div style={{ fontSize: '6rem', marginBottom: '40px', animation: 'float 3s infinite ease-in-out' }}>🎧</div>
            <button onClick={handleStartGame} className="hover-scale" style={{ padding: '18px 60px', fontSize: '1.5rem', borderRadius: '50px', border: 'none', background: 'linear-gradient(135deg, #3b82f6, #6366f1)', color: 'white', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 10px 25px rgba(59, 130, 246, 0.4)' }}>
                เริ่มทำข้อสอบ (เปิดเสียง) 🚀
            </button>
        </div>
      );
  }

  // Countdown Screen
  if (gameState === 'countdown') {
      return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(59, 130, 246, 0.95)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
            <h1 style={{ fontSize: '15rem', color: 'white', fontWeight: 'bold', margin: 0, animation: 'pulse 1s infinite' }}>{startCountdown}</h1>
            <p style={{ color: 'white', fontSize: '2rem', marginTop: '20px' }}>เตรียมตัว...</p>
        </div>
      );
  }

  // Finished Screen
  if (gameState === 'finished') {
      return (
        <div style={{ padding: '80px 20px', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
            <div style={{ background: 'white', maxWidth: '500px', width: '100%', borderRadius: '32px', padding: '50px 30px', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', textAlign: 'center' }}>
                <div style={{ width: '100px', height: '100px', background: isPassed ? '#dcfce7' : '#fee2e2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                    <i className={isPassed ? "fa-solid fa-trophy" : "fa-solid fa-face-sad-tear"} style={{ fontSize: '3.5rem', color: isPassed ? '#16a34a' : '#dc2626' }}></i>
                </div>
                <h2 style={{ fontSize: '2rem', color: '#1e293b', marginBottom: '10px' }}>{isPassed ? 'สอบผ่านแล้ว!' : 'ยังไม่ผ่านเกณฑ์'}</h2>
                <div style={{ fontSize: '4rem', fontWeight: 'bold', color: isPassed ? '#22c55e' : '#ef4444' }}>
                    {score} <span style={{ fontSize: '1.5rem', color: '#94a3b8' }}>/ {questions.length}</span>
                </div>
                <div style={{ marginTop: '40px', display: 'flex', gap: '10px', flexDirection: 'column' }}>
                    {!isPassed && <button onClick={handleRetry} style={{ padding: '15px', borderRadius: '15px', border: 'none', background: '#ef4444', color: 'white', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 'bold' }}>สอบแก้ตัว</button>}
                    <button onClick={handleBack} style={{ padding: '15px', borderRadius: '15px', border: '2px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 'bold' }}>กลับหน้ารวม</button>
                </div>
            </div>
        </div>
      );
  }

  // Playing Screen
  return (
    <div style={{ padding: '80px 20px', maxWidth: '800px', margin: '0 auto', fontFamily: "'Sarabun', sans-serif" }}>
      <div style={{ position: 'fixed', top: '80px', right: '20px', background: timeLeft <= 60 ? '#fee2e2' : 'white', padding: '10px 20px', borderRadius: '50px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: '10px', border: timeLeft <= 60 ? '2px solid #ef4444' : '2px solid #3b82f6', zIndex: 100 }}>
          <i className="fa-solid fa-clock" style={{color: timeLeft <= 60 ? '#ef4444' : '#3b82f6'}}></i>
          <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: timeLeft <= 60 ? '#b91c1c' : '#1e293b', fontFamily: 'monospace' }}>{formatTime(timeLeft)}</span>
      </div>

      <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 100 }}>
          <button onClick={toggleMute} style={{ width: '50px', height: '50px', borderRadius: '50%', border: 'none', background: 'white', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', cursor: 'pointer', color: isMuted ? '#94a3b8' : '#3b82f6', fontSize: '1.2rem' }}>
             <i className={isMuted ? "fa-solid fa-volume-xmark" : "fa-solid fa-volume-high"}></i>
          </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
         <div><span style={{ textTransform: 'uppercase', color: '#94a3b8', fontSize: '0.9rem', fontWeight: 'bold' }}>Lesson {id}</span><h2 style={{ margin: '5px 0 0', color: '#1e293b' }}>แบบทดสอบ</h2></div>
         <div style={{ padding: '5px 15px', background: '#eff6ff', borderRadius: '20px', color: '#3b82f6', fontWeight: 'bold' }}>ข้อ {currentQuestion + 1} / {questions.length}</div>
      </div>

      <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', marginBottom: '40px', overflow: 'hidden' }}>
         <div style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%`, height: '100%', background: '#3b82f6', transition: 'width 0.5s ease' }}></div>
      </div>

      <div style={{ background: 'white', padding: '40px', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
          {/* ✅ ส่วนแสดงรูปภาพ (Fit to Box) */}
          {questions[currentQuestion].image && (
              <div style={{ marginBottom: '25px', textAlign: 'center', width: '100%', display: 'flex', justifyContent: 'center' }}>
                  <img 
                      src={questions[currentQuestion].image} 
                      alt="Question" 
                      style={{ 
                          maxWidth: '60%',       
                          maxHeight: '200px',     
                          width: 'auto',          
                          height: 'auto',         
                          objectFit: 'contain',   
                          borderRadius: '12px',   
                          boxShadow: '0 4px 10px rgba(0,0,0,0.05)' 
                      }} 
                  />
              </div>
          )}

          <h2 style={{ fontSize: '1.5rem', color: '#1e293b', marginBottom: '30px', lineHeight: '1.6' }}>{questions[currentQuestion].question}</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {questions[currentQuestion].options.map((opt, index) => (
                  <button key={index} onClick={() => handleAnswer(index)} className="hover-scale" style={{ padding: '18px 25px', borderRadius: '16px', border: '2px solid #e2e8f0', background: 'white', color: '#475569', fontSize: '1.1rem', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s', fontWeight: '500' }}
                      onMouseOver={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.background = '#f8fafc'; }}
                      onMouseOut={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = 'white'; }}>
                      {opt}
                  </button>
              ))}
          </div>
      </div>
      <style>{`
        @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.2); } 100% { transform: scale(1); } }
        @keyframes float { 0% { transform: translateY(0px); } 50% { transform: translateY(-20px); } 100% { transform: translateY(0px); } }
      `}</style>
    </div>
  );
}

export default Quiz;
