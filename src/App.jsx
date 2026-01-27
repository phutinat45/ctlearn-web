import React from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';

import Login from './pages/Login';
import Home from './pages/Home';
import TeacherDashboard from './pages/TeacherDashboard';
import Lessons from './pages/Lessons';
import StudyRoom from './pages/StudyRoom'; 
import Rank from './pages/Rank';
import Profile from './pages/Profile';
import Quiz from './pages/Quiz'; 

function App() {
  const location = useLocation();

  // ฟังก์ชันป้องกัน Route (เพิ่ม try-catch กันแอปพัง)
  const ProtectedRoute = ({ children, allowedRole }) => {
    const userStr = localStorage.getItem('currentUser');
    
    if (!userStr) {
        return <Navigate to="/login" replace />;
    }

    try {
        const user = JSON.parse(userStr);
        
        // เช็ค Role ว่าตรงไหม
        if (allowedRole && user.role !== allowedRole) {
           // ถ้า Admin หลงมาหน้า Student -> ส่งไป Teacher
           if (user.role === 'admin') return <Navigate to="/teacher" replace />;
           // ถ้า Student หลงไปหน้า Admin -> ส่งไป Dashboard
           if (user.role === 'student') return <Navigate to="/dashboard" replace />;
        }
        
        return children;
    } catch (error) {
        // ถ้า JSON พัง หรือมีปัญหา ให้เคลียร์ค่าแล้วส่งไป Login ใหม่
        console.error("Auth Error:", error);
        localStorage.removeItem('currentUser');
        return <Navigate to="/login" replace />;
    }
  };
  
  // ซ่อน Navbar ถ้าเป็นหน้า Login หรือ หน้า Teacher ทั้งหมด
  const isHideNavbar = location.pathname === '/login' || location.pathname.startsWith('/teacher');

  return (
    <div className="app">
      {!isHideNavbar && <Navbar />} 
      
      <div className={!isHideNavbar ? "content" : ""}>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />

          {/* Student Routes */}
          <Route path="/dashboard" element={<ProtectedRoute allowedRole="student"><Home /></ProtectedRoute>} />
          <Route path="/lessons" element={<ProtectedRoute allowedRole="student"><Lessons /></ProtectedRoute>} />
          <Route path="/rank" element={<ProtectedRoute allowedRole="student"><Rank /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute allowedRole="student"><Profile /></ProtectedRoute>} />
          
          <Route path="/lesson/:id" element={<ProtectedRoute allowedRole="student"><StudyRoom /></ProtectedRoute>} />
          <Route path="/lesson/:id/quiz" element={<ProtectedRoute allowedRole="student"><Quiz /></ProtectedRoute>} />
          
          {/* Admin Routes */}
          {/* ใส่ /* ต่อท้าย เพื่อรองรับ sub-routes ในอนาคต เช่น /teacher/add-lesson */}
          <Route path="/teacher/*" element={<ProtectedRoute allowedRole="admin"><TeacherDashboard /></ProtectedRoute>} />

          {/* Catch-all: หน้าไหนไม่มีจริง ส่งไป Login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;