import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient'; 

function Login() {
  const navigate = useNavigate();
  
  // ✅ 1. เพิ่ม State สำหรับสลับโหมด (Login <-> Register)
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  // รวมข้อมูล Form ทั้งหมดไว้ที่เดียว
  const [formData, setFormData] = useState({ 
    username: '', 
    password: '', 
    // ส่วนเสริมสำหรับ Register
    fullname: '',
    confirmPassword: '',
    grade_level: 'ม.1'
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [currentSlide, setCurrentSlide] = useState(0);

  // ✅ เปลี่ยน images เป็น State และใส่ Default ไว้กันพลาด
  const [images, setImages] = useState([
    "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=1740&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=1740&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1531482615713-2afd69097998?q=80&w=1740&auto=format&fit=crop"
  ]);

  // ข้อความหน้าเว็บ
  const [loginText, setLoginText] = useState({
    title: 'ยินดีต้อนรับสู่ CTLearn',
    subtitle: 'เข้าสู่ระบบเพื่อเริ่มการเรียนรู้และพัฒนาทักษะของคุณ'
  });

  // ✅ ดึงข้อมูลรูปภาพและข้อความจาก Supabase เมื่อโหลดหน้าเว็บ
  useEffect(() => {
    const fetchPageData = async () => {
        try {
            // 1. ดึงรูปสไลด์ (login_slides)
            const { data: slidesData } = await supabase
                .from('login_slides')
                .select('image_url')
                .order('created_at', { ascending: false }); // เอารูปใหม่สุดขึ้นก่อน

            if (slidesData && slidesData.length > 0) {
                // แปลง object ให้เป็น array ของ url string
                setImages(slidesData.map(s => s.image_url));
            }

            // 2. ดึงข้อความตั้งค่า (site_settings)
            const { data: settingsData } = await supabase
                .from('site_settings')
                .select('*')
                .single();

            if (settingsData) {
                setLoginText({
                    title: settingsData.welcome_title || 'ยินดีต้อนรับสู่ CTLearn',
                    subtitle: settingsData.subtitle || 'เข้าสู่ระบบเพื่อเริ่มการเรียนรู้และพัฒนาทักษะของคุณ'
                });
                
                // (Optional) ถ้ามีการตั้งค่า Maintenance Mode อาจจะเช็คตรงนี้ได้
            }

        } catch (error) {
            console.error("Error fetching login data:", error);
        }
    };

    fetchPageData();
  }, []);

  // Slider Logic
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % images.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [images.length]); // dependency เป็น images.length เพื่อให้ reset loop เมื่อรูปเปลี่ยน

  // ฟังก์ชันอัปเดตข้อมูลใน Form
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // --- ฟังก์ชันเข้าสู่ระบบ (Login) ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', formData.username)
        .eq('password', formData.password) 
        .eq('status', 'active') 
        .single();

      if (error || !data) throw new Error('ชื่อผู้ใช้งาน หรือ รหัสผ่านไม่ถูกต้อง');

      // บันทึก User
      localStorage.setItem('currentUser', JSON.stringify(data));

      // Redirect ตาม Role
      if (data.role === 'admin') {
          navigate('/teacher');    
      } else {
          navigate('/dashboard');  
      }

    } catch (err) {
      console.error(err);
      setErrorMsg('❌ ' + (err.message || 'เกิดข้อผิดพลาด'));
    } finally {
      setLoading(false);
    }
  };

  // --- ฟังก์ชันสมัครสมาชิก (Register) ---
  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (formData.password !== formData.confirmPassword) {
      setErrorMsg("❌ รหัสผ่านไม่ตรงกัน");
      return;
    }

    setLoading(true);
    try {
      // 1. เช็ค Username ซ้ำ
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('username', formData.username)
        .single();

      if (existingUser) {
        throw new Error("ชื่อผู้ใช้งานนี้มีคนใช้แล้ว");
      }

      // 2. บันทึกข้อมูล
      const newUser = {
        fullname: formData.fullname,
        username: formData.username,
        password: formData.password,
        grade_level: formData.grade_level,
        role: 'student',
        status: 'active'
      };

      const { error } = await supabase.from('users').insert([newUser]);
      if (error) throw error;

      alert("✅ สมัครสมาชิกสำเร็จ! กรุณาเข้าสู่ระบบ");
      setIsRegisterMode(false);
      setFormData({ ...formData, password: '', confirmPassword: '' });

    } catch (error) {
      console.error(error);
      setErrorMsg("❌ " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      
      {/* ฝั่งซ้าย: Slider */}
      <div className="login-left">
        <div className="slider-container">
            <div className="slider-track" style={{ transform: `translateX(-${currentSlide * 100}%)` }}>
                {images.map((img, index) => (
                    <div key={index} className="slide-item" style={{ backgroundImage: `url(${img})` }}></div>
                ))}
            </div>
        </div>
        <div className="slider-overlay"></div>
        <div className="left-content">
          <div className="brand-circle"><i className="fa-solid fa-star"></i></div>
          <h1>{loginText.title}</h1>
          <p>{loginText.subtitle}</p>
          <div className="website-link"><i className="fa-solid fa-globe"></i> www.ctlearn.com</div>
        </div>
      </div>

      {/* ฝั่งขวา: Login / Register Form */}
      <div className="login-right">
        <div className="form-container" style={{maxWidth: isRegisterMode ? '450px' : '400px'}}> 
          
          <h2>{isRegisterMode ? 'สมัครสมาชิกใหม่' : 'เข้าสู่ระบบ'}</h2>
          
          {errorMsg && <div style={{color:'#b91c1c', background:'#fee2e2', padding:'10px', borderRadius:'5px', marginBottom:'15px', fontSize:'0.9rem', textAlign:'center', border:'1px solid #fecaca'}}>{errorMsg}</div>}

          <form onSubmit={isRegisterMode ? handleRegister : handleLogin}>
            
            {/* Register Fields */}
            {isRegisterMode && (
                <>
                    <div className="input-line-group">
                        <i className="fa-solid fa-id-card"></i>
                        <input type="text" name="fullname" placeholder="ชื่อ-นามสกุล" required value={formData.fullname} onChange={handleChange} />
                    </div>
                    <div className="input-line-group">
                        <i className="fa-solid fa-graduation-cap"></i>
                        <select name="grade_level" value={formData.grade_level} onChange={handleChange} style={{border:'none', outline:'none', width:'100%', color:'#333', background:'transparent'}}>
                            <option value="ม.1">มัธยมศึกษาปีที่ 1</option>
                            <option value="ม.2">มัธยมศึกษาปีที่ 2</option>
                            <option value="ม.3">มัธยมศึกษาปีที่ 3</option>
                            <option value="ม.4">มัธยมศึกษาปีที่ 4</option>
                            <option value="ม.5">มัธยมศึกษาปีที่ 5</option>
                            <option value="ม.6">มัธยมศึกษาปีที่ 6</option>
                        </select>
                    </div>
                </>
            )}

            {/* Login Fields */}
            <div className="input-line-group">
                <i className="fa-regular fa-user"></i>
                <input type="text" name="username" placeholder="ชื่อผู้ใช้งาน (Username)" required value={formData.username} onChange={handleChange} />
            </div>
            <div className="input-line-group" style={{marginBottom: isRegisterMode ? '15px' : '30px'}}>
                <i className="fa-solid fa-lock"></i>
                <input type="password" name="password" placeholder="รหัสผ่าน" required value={formData.password} onChange={handleChange} />
            </div>

            {/* Confirm Password (Register) */}
            {isRegisterMode && (
                <div className="input-line-group" style={{marginBottom: '30px'}}>
                    <i className="fa-solid fa-lock"></i>
                    <input type="password" name="confirmPassword" placeholder="ยืนยันรหัสผ่านอีกครั้ง" required value={formData.confirmPassword} onChange={handleChange} />
                </div>
            )}
            
            <button type="submit" className="btn-gradient" disabled={loading}>
                {loading ? 'กำลังทำงาน...' : (isRegisterMode ? 'ยืนยันการสมัคร' : 'เข้าสู่ระบบ')}
            </button>
          </form>

          {/* Toggle Button */}
          <div className="toggle-auth" style={{marginTop:'20px', textAlign:'center'}}>
            {isRegisterMode ? 'มีบัญชีอยู่แล้ว?' : 'ยังไม่มีบัญชีใช่ไหม?'} 
            <span 
              onClick={() => {
                  setIsRegisterMode(!isRegisterMode); 
                  setErrorMsg(''); 
              }} 
              style={{color:'#3b82f6', cursor:'pointer', fontWeight:'bold', marginLeft:'5px'}}
            >
              {isRegisterMode ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
            </span>
          </div>

        </div>
      </div>
    </div>
  );
}

export default Login;