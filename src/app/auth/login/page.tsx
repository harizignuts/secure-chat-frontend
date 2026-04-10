"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authService } from "@/services/authService";
import { setToken, getToken } from "@/utils/tokenStorage";
import "react-toastify/dist/ReactToastify.css";
import { useToast } from "@/contexts/ToastContext";
import { GoogleLogin } from "@react-oauth/google";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);  
  const router = useRouter();

  const { setToast, showToast, getToast } = useToast();

  useEffect(() => {
    if (getToast() !== null) {
      showToast();
    }
  }, [showToast, getToast]);

  useEffect(() => {
    if (getToken()) {
      router.replace("/");
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await authService.auth("login", { email, password });
      if (response?.statusCode === 200) {
        setToken(response.data.token);
        setToast("Login successful.");
        router.replace("/");
      } else {
        setError(response.error);
      }
    } catch (error) {
      setError("An error occurred. Please try again later.");
      console.error("Error during login", error);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleGoogleLogin = async (response: any) => {
    setLoading(true);
    try {
      console.log(response);
      const data = await authService.google(response.credential);
      console.log(data);
      if (data?.statusCode === 200) {
      setToken(data.data.token);
      setToast("Login successful.");
      router.replace("/");
      } else {
      setError(data.error);
      }
    } catch (error) {
      setError("An error occurred. Please try again later.");
      console.error("Error during Google login", error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const { name, value } = e.target;
    if (name === "email") {
      setEmail(value);
    } else {
      setPassword(value);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#fdfcff] relative overflow-hidden">
      {/* Top Background Banner Using Primary Color */}
      <div className="absolute top-0 left-0 w-full h-[35vh] bg-[#624185] z-0" />

      {/* Main Card */}
      <div className="bg-[#faf8fc] shadow-2xl rounded-2xl p-10 max-w-md w-full z-10 relative mt-8 border border-[#e2d8ee]">
        
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#624185] mb-2">Welcome Back</h1>
          <p className="text-[#54656f]">Please sign in to continue</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-[#54656f] mb-1">Email Address</label>
            <input
              type="email"
              name="email"
              value={email}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#624185] focus:border-[#624185] outline-none transition-all placeholder-gray-400"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#54656f] mb-1">Password</label>
            <input
              type="password"
              name="password"
              value={password}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#624185] focus:border-[#624185] outline-none transition-all placeholder-gray-400"
              placeholder="••••••••"
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-[#624185] hover:bg-[#F2AD73] disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl transition-all duration-300 shadow-md hover:shadow-lg mt-4"
          >
            {loading ? "Signing in..." : "Login"}
          </button>

          <div className="relative my-6 flex items-center">
            <div className="flex-grow border-t border-gray-200"></div>
            <span className="flex-shrink-0 mx-4 text-gray-400 text-sm">or sign in with</span>
            <div className="flex-grow border-t border-gray-200"></div>
          </div>

          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleLogin}
              onError={() => console.log("Login Failed")}
              theme="outline"
              size="large"
            />
          </div>
        </form>

        <div className="mt-8 text-center text-sm text-[#54656f]">
          <p>Don&apos;t have an account?</p>
          <button
            onClick={() => router.push("/auth/signup")}
            className="text-[#F2AD73] hover:text-[#624185] font-semibold mt-1 transition-colors relative after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-full after:bg-[#624185] after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:duration-300"
          >
            Create an account
          </button>
        </div>

      </div>
    </div>
  );
};

export default LoginPage;
