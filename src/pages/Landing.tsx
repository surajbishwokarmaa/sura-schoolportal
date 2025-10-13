import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const Landing = () => {
  const navigate = useNavigate();
  const { user, userRole, loading } = useAuth();

  useEffect(() => {
    if (!loading && user && userRole) {
      // Redirect based on role
      if (userRole === 'admin') navigate('/admin');
      else if (userRole === 'teacher') navigate('/teacher');
      else if (userRole === 'student') navigate('/student');
    }
  }, [user, userRole, loading, navigate]);

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/select-role');
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen gradient-hero flex flex-col items-center justify-center p-8 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-secondary/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary-light/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="text-center z-10 space-y-8 animate-in fade-in duration-1000">
        <div className="flex items-center justify-center mb-8">
          <div className="relative">
            <GraduationCap className="w-32 h-32 text-white drop-shadow-2xl animate-in zoom-in duration-700" />
            <Sparkles className="w-8 h-8 text-secondary absolute -top-2 -right-2 animate-pulse" />
          </div>
        </div>

        <div className="space-y-4">
          <h1 className="text-5xl md:text-7xl font-bold text-white drop-shadow-lg animate-in slide-in-from-bottom duration-700 delay-200">
            Buddha Deep English
          </h1>
          <h1 className="text-4xl md:text-6xl font-bold text-white drop-shadow-lg animate-in slide-in-from-bottom duration-700 delay-300">
            Boarding School
          </h1>
          <div className="h-1 w-64 mx-auto gradient-secondary rounded-full animate-in slide-in-from-left duration-700 delay-500"></div>
          <p className="text-2xl md:text-3xl text-white/90 font-medium animate-in slide-in-from-bottom duration-700 delay-700">
            Sura School Portal
          </p>
          <p className="text-xl md:text-2xl text-white/80 italic animate-in fade-in duration-700 delay-1000">
            "Empowering Minds, Building Futures"
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 text-white/70 animate-in fade-in duration-700 delay-1500">
          <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-white rounded-full animate-bounce delay-100"></div>
          <div className="w-2 h-2 bg-white rounded-full animate-bounce delay-200"></div>
        </div>
      </div>
    </div>
  );
};

export default Landing;
