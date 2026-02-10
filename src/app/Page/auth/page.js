import AuthFormClient from "./_components/AuthFormClient";

export default function AuthPage() {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center gap-6 bg-gray-50">
      <div className="text-center">
        <h1 className="font-bold text-4xl text-gray-800 mb-2">Welcome Back</h1>
        <p className="text-gray-600">Sign in to your account</p>
      </div>

      <AuthFormClient />
    </div>
  );
}
