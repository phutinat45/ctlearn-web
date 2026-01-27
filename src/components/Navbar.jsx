import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient'; 

function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    totalXP: 0,
    streak: 0 
  });

  const isActive = (path) => {
    return location.pathname === path ? 'active' : '';
  };

  // --- ฟังก์ชันคำนวณ Streak (เหมือนเดิม) ---
  const calculateStreak = (progressData) => {
    if (!progressData || progressData.length === 0) return 0;

    const toLocalDateStr = (dateStr) => {
        const d = new Date(dateStr);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const uniqueDates = new Set(progressData.map(p => toLocalDateStr(p.created_at)));

    let streak = 0;
    let d = new Date(); 

    const todayStr = toLocalDateStr(d);
    const hasToday = uniqueDates.has(todayStr);
    
    d.setDate(d.getDate() - 1); 
    const yesterdayStr = toLocalDateStr(d);
    const hasYesterday = uniqueDates.has(yesterdayStr);

    if (!hasToday && !hasYesterday) return 0;

    let checkDate = new Date();
    if (!hasToday) checkDate.setDate(checkDate.getDate() - 1);

    while (true) {
        const dateStr = toLocalDateStr(checkDate);
        if (uniqueDates.has(dateStr)) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1); 
        } else {
            break; 
        }
    }
    return streak;
  };

  // --- ฟังก์ชันดึงข้อมูล (ฉบับอัปเกรดความเร็ว 🚀) ---
  const fetchUserStats = async () => {
    try {
        const userStr = localStorage.getItem('currentUser');
        if (!userStr) return;

        const user = JSON.parse(userStr);

        // ✅ แก้ไขจุดนี้: ใช้การ Join Table (lessons) มาในคำสั่งเดียว
        // แปลว่า: "ไปเอาประวัติการเรียนมา และฝากหยิบค่า XP ของบทเรียนนั้นติดมือมาด้วยเลย"
        const { data: progressData, error } = await supabase
            .from('progress')
            .select(`
                created_at,
                lesson_id,
                lessons ( xp )
            `)
            .eq('student_id', user.id)
            .eq('passed', true);

        if (error) {
             // กรณี Database ยังไม่ทำ Foreign Key มันจะ Error เราจะรู้ทันที
             console.error("Join Error (อาจยังไม่ได้เชื่อมตาราง):", error.message);
             return;
        }

        if (progressData) {
            // 1. คำนวณ XP รวม (ดึงจากตัวแปร lessons ที่ติดมาได้เลย)
            const totalXP = progressData.reduce((sum, item) => {
                // เช็คว่ามีข้อมูล lessons ไหม (กันเหนียว)
                const lessonXP = item.lessons?.xp || 0;
                return sum + lessonXP;
            }, 0);

            // 2. คำนวณ Streak
            const currentStreak = calculateStreak(progressData);

            setStats({
                totalXP: totalXP,
                streak: currentStreak
            });
        }

    } catch (err) {
        console.error("Navbar Error:", err.message);
    }
  };

  useEffect(() => {
    fetchUserStats(); 
    window.addEventListener('xp-updated', fetchUserStats);
    return () => {
      window.removeEventListener('xp-updated', fetchUserStats);
    };
  }, []);

  const handleLogout = async () => {
    localStorage.removeItem('currentUser');
    await supabase.auth.signOut();
    window.location.href = '/login'; 
  };

  return (
    <nav className="navbar">
      <div className="nav-container">
        
        <Link to="/dashboard" className="logo-link">
            <div className="logo-icon">
                <i className="fa-solid fa-star"></i>
            </div>
            <div className="logo-text">
                CT<span className="text-blue">Learn</span>
            </div>
        </Link>

        {/* เมนูตรงกลาง */}
        <div className="nav-center">
            <Link to="/dashboard" className={`nav-item ${isActive('/dashboard')}`}>
                <i className="fa-solid fa-house"></i> <span>หน้าแรก</span>
            </Link>
            <Link to="/lessons" className={`nav-item ${isActive('/lessons')}`}>
                <i className="fa-solid fa-book-open"></i> <span>บทเรียน</span>
            </Link>
            <Link to="/rank" className={`nav-item ${isActive('/rank')}`}>
                <i className="fa-solid fa-trophy"></i> <span>อันดับ</span>
            </Link>
            <Link to="/profile" className={`nav-item ${isActive('/profile')}`}>
                <i className="fa-regular fa-user"></i> <span>โปรไฟล์</span>
            </Link>
        </div>

        {/* ส่วนขวา */}
        <div className="nav-right">
            <div className="streak-chip" title="เรียนต่อเนื่อง (วัน)">
                <i className="fa-solid fa-fire" style={{color: '#ff5722'}}></i> {stats.streak}
            </div>
            
            <div className="xp-chip" key={stats.totalXP} style={{ animation: 'popIn 0.3s ease-out' }} title="คะแนนประสบการณ์รวม">
                <i className="fa-solid fa-star"></i> {stats.totalXP} XP
            </div>
            
            <div className="divider-vertical"></div> 

            <button className="btn-logout-text" onClick={handleLogout} title="ออกจากระบบ">
                <i className="fa-solid fa-right-from-bracket"></i> ออกจากระบบ
            </button>
        </div>

      </div>
    </nav>
  );
}

export default Navbar;
