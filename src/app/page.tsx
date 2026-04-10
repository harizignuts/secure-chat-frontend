"use client";
import { useToast } from "@/contexts/ToastContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const Home = () => {
  const router = useRouter();
  const { showToast, getToast } = useToast();
  
  useEffect(() => {
    if (getToast() !== null) {
      showToast();
    }
  }, [showToast, getToast]);

  const handleChat = () => {
    router.push("/chat");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#fdfcff] relative overflow-hidden">
      {/* Top Background Banner Using Primary Color */}
      <div className="absolute top-0 left-0 w-full h-[35vh] bg-[#624185] z-0" />

      {/* Main Card */}
      <div className="bg-[#faf8fc] shadow-2xl rounded-2xl p-10 max-w-lg w-full z-10 text-center relative mt-8 border border-[#e2d8ee]">
        
        {/* Icon / Avatar using Secondary Color */}
        <div className="w-24 h-24 bg-[#F2AD73] rounded-full mx-auto flex items-center justify-center mb-6 shadow-md border-4 border-white">
           <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
           </svg>
        </div>

        <h1 className="text-[32px] font-bold mb-4 text-[#624185]">Secure Chat</h1>
        
        <p className="text-[#54656f] text-[16px] mb-8 leading-relaxed px-4">
          Welcome to your new communication hub. Instantly connect with your friends and colleagues in real-time, secured with state-of-the-art encryption.
        </p>

        <div className="flex flex-col space-y-4 px-4">
          <button
            onClick={handleChat}
            className="w-full bg-[#624185] hover:bg-[#F2AD73] text-white font-bold py-3.5 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1 text-lg"
          >
            Start Chatting
          </button>
        </div>

      </div>
    </div>
  );
};

export default Home;
