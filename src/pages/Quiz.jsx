import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import confetti from 'canvas-confetti';

function Quiz() {
  const { id } = useParams();
  const navigate = useNavigate();

  // --- State ---
  const [questions, setQuestions] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [lessonXP, setLessonXP] = useState(0);

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [showScore, setShowScore] = useState(false);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [isPassed, setIsPassed] = useState(false);

  // ✅ State เวลา (เริ่มเป็น null เพื่อป้องกันการทำงานก่อนโหลดเสร็จ)
  const [timeLeft, setTimeLeft] = useState(null);

  // Helper แปลงเวลา
  const formatTime = (seconds) => {
    if (seconds === null) return "--:--";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // --- 1. Fetch Data ---
  useEffect(() => {
    const fetchQuizData = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('lessons')
          .select('quiz, xp, duration') 
          .eq('id', id)
          .single();

        if (error) throw error;
        
        setLessonXP(data.xp || 0);

        // ตั้งเวลา (ดึงจาก DB หรือ Default 15 นาที)
        const durationStr = data.duration || "15";
        const minutes = parseInt(durationStr.replace(/\D/g, '')) || 15; 
        setTimeLeft(minutes * 60);

        if (data && data.quiz && Array.isArray(data.quiz) && data.quiz.length > 0) {
          const formattedQuestions = data.quiz.map((q) => ({
            questionText: q.question,
            answerOptions: q.options.map((opt) => ({
              answerText: opt,
              isCorrect: opt === q.answer 
            }))
          }));
          setQuestions(formattedQuestions);
        } else {
          setQuestions([]); 
        }

      } catch (error) {
        console.error('Error fetching quiz:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchQuizData();
  }, [id]);

  // --- 2. Timer & Auto Submit Logic ---
  useEffect(() => {
    // ถ้าจบแล้ว หรือ กำลังโหลด หรือเวลายังไม่ถูกตั้งค่า -> ไม่ต้องทำอะไร
    if (showScore || loading || timeLeft === null) return;

    // ✅ ถ้าเวลาหมด (0) -> ส่งข้อสอบอัตโนมัติ
    if (timeLeft === 0) {
        finishQuiz(score); // ส่งคะแนนปัจจุบันไปคำนวณเลย
        return;
    }

    // นับถอยหลังทีละ 1 วินาที
    const timer = setInterval(() => {
        setTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, showScore, loading, score]); // ใส่ score ใน dependency เพื่อให้ตอนส่งค่าเป็นค่าล่าสุด

  // --- Logic ตรวจคำตอบ ---
  const handleAnswerOptionClick = (isCorrect, index) => {
    if (isAnswered) return; 
    setSelectedAnswer(index);
    setIsAnswered(true);

    let newScore = score;
    if (isCorrect) {
      newScore = score + 1;
      setScore(newScore);
    }

    setTimeout(() => {
      const nextQuestion = currentQuestion + 1;
      if (nextQuestion < questions.length) {
        setCurrentQuestion(nextQuestion);
        setIsAnswered(false);
        setSelectedAnswer(null);
      } else {
        finishQuiz(newScore);
      }
    }, 1000);
  };

  const finishQuiz = (finalScore) => {
    const totalQuestions = questions.length;
    const passed = finalScore > (totalQuestions / 2);
    
    setIsPassed(passed);
    setShowScore(true); // พอ set true ปุ๊บ useEffect ของ Timer จะหยุดทำงานทันที

    if (passed) {
        fireConfetti();
        saveProgress(finalScore); 
    }
  };

  const saveProgress = async (finalScore) => {
    try {
        const userStr = localStorage.getItem('currentUser');
        if (!userStr) return;
        
        const user = JSON.parse(userStr);
        
        const { data: existing } = await supabase
            .from('progress')
            .select('*')
            .eq('student_id', user.id)
            .eq('lesson_id', id)
            .single();

        const alreadyPassed = existing && existing.passed === true;

        if (existing) {
            await supabase
                .from('progress')
                .update({ passed: true, score: finalScore })
                .eq('id', existing.id);
        } else {
            await supabase
                .from('progress')
                .insert({ student_id: user.id, lesson_id: id, passed: true, score: finalScore });
        }

        if (!alreadyPassed) {
            await updateUserXP(user.id, lessonXP);
        }
    } catch (error) {
        console.error("Error saving progress:", error);
    }
  };

  const updateUserXP = async (userId, xpToAdd) => {
      try {
          // เนื่องจาก DB คุณไม่มี col xp ใน users (ตามที่คุยกันก่อนหน้า) 
          // ส่วนนี้อาจจะ error ถ้ายังไม่ได้แก้ DB แต่ผมใส่ไว้เผื่อคุณแก้ DB แล้ว
          // หรือถ้าใช้ระบบคำนวณสดจาก Navbar แล้ว ส่วนนี้ก็แค่ยิง Event บอก Navbar ก็พอครับ
          
          /* ถ้าแก้ DB แล้ว uncomment บรรทัดล่างนี้ได้เลย */
          // const { data: userData } = await supabase.from('users').select('xp').eq('id', userId).single();
          // const currentXP = userData?.xp || 0;
          // await supabase.from('users').update({ xp: currentXP + xpToAdd }).eq('id', userId);

          // อัปเดต LocalStorage (เผื่อใช้)
          const currentUser = JSON.parse(localStorage.getItem('currentUser'));
          if (currentUser) {
              // currentUser.xp = (currentUser.xp || 0) + xpToAdd; 
              // localStorage.setItem('currentUser', JSON.stringify(currentUser));
              
              // ✅ ส่งสัญญาณบอก Navbar ให้คำนวณ XP ใหม่
              window.dispatchEvent(new Event('xp-updated'));
          }
      } catch (error) { console.error(error); }
  };

  const fireConfetti = () => {
    const duration = 3000;
    const end = Date.now() + duration;
    (function frame() {
      confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#22c55e', '#eab308'] });
      confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#22c55e', '#eab308'] });
      if (Date.now() < end) requestAnimationFrame(frame);
    }());
  };

  const restartQuiz = () => {
    setScore(0);
    setCurrentQuestion(0);
    setShowScore(false);
    setIsAnswered(false);
    setSelectedAnswer(null);
    setIsPassed(false);
    
    // รีเซ็ตเวลาใหม่ (15 นาที หรือตาม DB)
    // ตรงนี้ผม hardcode ให้รีเฟรชหน้าไปเลยง่ายกว่า หรือจะดึงค่าเดิมก็ได้
    window.location.reload(); 
  };

  // --- UI ---
  if (loading) return <div style={{ padding: '100px', textAlign: 'center' }}>กำลังโหลด...</div>;
  if (!questions || questions.length === 0) return <div style={{ padding: '100px', textAlign: 'center' }}>ไม่พบข้อสอบ</div>;

  // หน้าสรุปผล (Result)
  if (showScore) {
    return (
      <div style={{ padding: '80px 20px', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontFamily: "'Sarabun', sans-serif" }}>
        <div style={{ background: 'white', maxWidth: '500px', width: '100%', borderRadius: '32px', padding: '50px 30px', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '10px', background: isPassed ? '#22c55e' : '#ef4444' }}></div>
          
          <div style={{ marginBottom: '20px' }}>
             {isPassed ? 
                 <div style={{ width: '100px', height: '100px', background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}><i className="fa-solid fa-trophy" style={{ fontSize: '3.5rem', color: '#16a34a' }}></i></div> : 
                 <div style={{ width: '100px', height: '100px', background: '#fee2e2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}><i className="fa-solid fa-face-frown-open" style={{ fontSize: '3.5rem', color: '#dc2626' }}></i></div>
             }
          </div>

          <h1 style={{ fontSize: '2rem', margin: '0 0 10px', color: '#1e293b' }}>
              {timeLeft === 0 && !isPassed ? 'หมดเวลา!' : (isPassed ? 'ยอดเยี่ยมมาก!' : 'ไม่ต้องเสียใจนะ')}
          </h1>
          <p style={{ color: '#64748b', margin: '0 0 30px' }}>
              {timeLeft === 0 && !isPassed ? 'ระบบส่งคำตอบอัตโนมัติ' : (isPassed ? 'คุณสอบผ่านเกณฑ์ที่กำหนดแล้ว' : 'ลองทบทวนเนื้อหาแล้วสอบใหม่อีกครั้ง')}
          </p>
          
          <div style={{ background: '#f8fafc', borderRadius: '20px', padding: '30px', marginBottom: '30px', border: '1px solid #e2e8f0' }}>
              <span style={{ display: 'block', fontSize: '0.9rem', color: '#64748b', marginBottom: '5px' }}>คะแนนของคุณ</span>
              <div style={{ fontSize: '3.5rem', fontWeight: '800', color: isPassed ? '#22c55e' : '#ef4444', lineHeight: 1 }}>{score} <span style={{ fontSize: '1.5rem', color: '#94a3b8', fontWeight: 'normal' }}>/ {questions.length}</span></div>
              {isPassed && <div style={{ marginTop: '15px', display: 'inline-block', padding: '8px 20px', background: '#fefce8', borderRadius: '50px', color: '#854d0e', fontSize: '1rem', fontWeight: 'bold', border: '1px solid #fef08a' }}><i className="fa-solid fa-star" style={{color:'#eab308'}}></i> ได้รับ +{lessonXP} XP</div>}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {!isPassed && <button onClick={restartQuiz} className="hover-scale" style={{ width: '100%', padding: '16px', borderRadius: '16px', border: 'none', background: '#ef4444', color: 'white', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer' }}><i className="fa-solid fa-rotate-right" style={{ marginRight: '8px' }}></i> สอบแก้ตัว</button>}
            <button onClick={() => navigate('/lessons')} className="hover-scale" style={{ width: '100%', padding: '16px', borderRadius: '16px', border: isPassed ? 'none' : '2px solid #e2e8f0', background: isPassed ? '#3b82f6' : 'white', color: isPassed ? 'white' : '#64748b', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer' }}>{isPassed ? 'กลับหน้ารวมบทเรียน' : 'กลับไปทบทวนเนื้อหา'}</button>
          </div>
        </div>
      </div>
    );
  }

  // หน้าทำข้อสอบ
  return (
    <div style={{ padding: '100px 20px', maxWidth: '800px', margin: '0 auto', fontFamily: "'Sarabun', sans-serif", position: 'relative' }}>
      
      {/* ✅ นาฬิกาจับเวลา (เปลี่ยนสีแดงเมื่อ < 1 นาที) */}
      <div style={{
          position: 'fixed', top: '80px', right: '20px',
          background: timeLeft !== null && timeLeft <= 60 ? '#fee2e2' : 'white',
          padding: '10px 20px', borderRadius: '50px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
          display: 'flex', alignItems: 'center', gap: '10px',
          border: timeLeft !== null && timeLeft <= 60 ? '2px solid #ef4444' : '2px solid #3b82f6',
          zIndex: 100, transition: 'all 0.3s'
      }}>
          <i className="fa-solid fa-clock" style={{color: timeLeft !== null && timeLeft <= 60 ? '#ef4444' : '#3b82f6', fontSize: '1.2rem'}}></i>
          <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: timeLeft !== null && timeLeft <= 60 ? '#b91c1c' : '#1e293b', fontFamily: 'monospace' }}>
              {formatTime(timeLeft)}
          </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px', alignItems: 'center' }}>
        <div><span style={{ textTransform: 'uppercase', color: '#64748b', fontSize: '0.85rem', fontWeight: 'bold' }}>Lesson {id}</span><h2 style={{ margin: '5px 0 0', color: '#1e293b' }}>แบบทดสอบท้ายบท</h2></div>
        <div style={{ background: '#eff6ff', color: '#3b82f6', padding: '8px 16px', borderRadius: '50px', fontWeight: 'bold' }}>{currentQuestion + 1} / {questions.length}</div>
      </div>
      
      <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', marginBottom: '40px', overflow: 'hidden' }}>
          <div style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%`, height: '100%', background: '#3b82f6', transition: 'width 0.3s ease' }}></div>
      </div>

      <div style={{ background: 'white', padding: '40px', borderRadius: '24px', boxShadow: '0 4px 25px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' }}>
        <h3 style={{ fontSize: '1.4rem', marginBottom: '30px', color: '#1e293b' }}>{questions[currentQuestion].questionText}</h3>
        <div style={{ display: 'grid', gap: '15px' }}>
            {questions[currentQuestion].answerOptions.map((option, index) => {
                let bgColor = 'white', borderColor = '#e2e8f0', textColor = '#475569', icon = null;
                if (isAnswered) {
                    if (index === selectedAnswer) {
                        if (option.isCorrect) { bgColor = '#f0fdf4'; borderColor = '#22c55e'; textColor = '#15803d'; icon = 'fa-check'; }
                        else { bgColor = '#fef2f2'; borderColor = '#ef4444'; textColor = '#b91c1c'; icon = 'fa-xmark'; }
                    } else if (option.isCorrect) { bgColor = '#f0fdf4'; borderColor = '#86efac'; textColor = '#15803d'; }
                }
                return (
                    <button key={index} onClick={() => handleAnswerOptionClick(option.isCorrect, index)} disabled={isAnswered} style={{ width: '100%', padding: '20px', borderRadius: '16px', border: `2px solid ${borderColor}`, background: bgColor, color: textColor, fontSize: '1.1rem', textAlign: 'left', cursor: isAnswered ? 'default' : 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.2s', fontWeight: '500' }}>
                        {option.answerText} {icon && <i className={`fa-solid ${icon}`}></i>}
                    </button>
                );
            })}
        </div>
      </div>
    </div>
  );
}

export default Quiz;