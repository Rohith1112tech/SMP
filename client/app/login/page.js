import LoginForm from "@/components/auth/LoginForm";

export const metadata = {
  title: "Login — School Management Platform",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center gradient-mesh relative overflow-hidden">
      {/* Decorative orbs */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-600/5 rounded-full blur-3xl pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 w-full max-w-md px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in">
          {/* Logo */}
          <div className="flex justify-center mb-5">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-indigo-500/25">
                <span className="text-3xl">🎓</span>
              </div>
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 opacity-20 blur-lg" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-white mb-1 tracking-tight">
            School Management Platform
          </h1>
          <p className="text-sm text-slate-400">
            Sign in to access your dashboard
          </p>
        </div>

        {/* Login Form */}
        <LoginForm />
      </div>
    </div>
  );
}
