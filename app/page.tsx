"use client"

import type React from "react"
import Image from "next/image"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { authService, type User as UserType } from "@/lib/supabase"
import Dashboard from "./components/dashboard"

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [user, setUser] = useState<UserType | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    number: "",
  })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setIsHydrated(true)
    
    const savedUser = localStorage.getItem("jb-orca-user")
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser) as UserType
        setUser(userData)
        setIsLoggedIn(true)
      } catch (error) {
        localStorage.removeItem("jb-orca-user")
      }
    }
  }, [])

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const { user: userData, error: loginError } = await authService.login(
        formData.name.trim(),
        formData.number.trim()
      )

      if (loginError) {
        setError(loginError)
        return
      }

      if (userData) {
        setUser(userData)
        setIsLoggedIn(true)
        localStorage.setItem("jb-orca-user", JSON.stringify(userData))
        
        // 폼 초기화
        setFormData({ name: "", number: "" })
      }
    } catch (err) {
      setError("로그인 중 오류가 발생했습니다.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = () => {
    setIsLoggedIn(false)
    setUser(null)
    localStorage.removeItem("jb-orca-user")
  }

  const handleNumberChange = (value: string) => {
    setFormData({ ...formData, number: value })
  }

  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 relative animate-pulse mx-auto mb-4">
            <Image
              src="/JB_Logo_White.png"
              alt="JB ORCA 로고"
              fill
              className="object-contain"
            />
          </div>
        </div>
      </div>
    )
  }

  if (isLoggedIn && user) {
    return <Dashboard user={user} onLogout={handleLogout} />
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 relative overflow-hidden">
      {/* 배경 그라데이션 및 효과 */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 via-black to-black opacity-80" />
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-900/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-indigo-900/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-sm relative z-10 flex flex-col items-center">
        {/* 로고 영역 */}
        <div className="mb-12 relative animate-in fade-in zoom-in duration-700">
          <div className="w-28 h-28 relative">
             <Image 
               src="/JB_Logo_White.png" 
               alt="Logo" 
               fill 
               className="object-contain drop-shadow-[0_0_25px_rgba(255,255,255,0.15)]" 
             />
          </div>
        </div>

        {/* 로그인 폼 카드 */}
        <Card className="w-full bg-zinc-900/30 border border-white/5 backdrop-blur-xl shadow-2xl overflow-hidden rounded-2xl">
          <CardHeader className="text-center pb-2 pt-8">
            <CardTitle className="text-xl font-bold text-white tracking-[0.2em]">LOGIN</CardTitle>
          </CardHeader>
          <CardContent className="p-8 pt-6">
             <form onSubmit={handleLogin} className="space-y-6">
               <div className="space-y-5">
                 <div className="space-y-2">
                   <Label htmlFor="name" className="text-zinc-500 text-[10px] font-bold tracking-widest ml-1 uppercase">Name</Label>
                   <Input
                     id="name"
                     placeholder="이름을 입력하세요"
                     value={formData.name}
                     onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                     className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 h-12 rounded-xl focus:border-white/30 focus:ring-0 focus:bg-white/10 transition-all text-center font-medium"
                   />
                 </div>
                 
                 <div className="space-y-2">
                   <Label htmlFor="number" className="text-zinc-500 text-[10px] font-bold tracking-widest ml-1 uppercase">Number</Label>
                   <Input
                     id="number"
                     placeholder="등번호를 입력하세요"
                     value={formData.number}
                     onChange={(e) => handleNumberChange(e.target.value)}
                     className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 h-12 rounded-xl focus:border-white/30 focus:ring-0 focus:bg-white/10 transition-all text-center font-medium"
                   />
                 </div>
               </div>

               {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg animate-in fade-in slide-in-from-top-1">
                  <p className="text-red-400 text-xs text-center font-medium">{error}</p>
                </div>
              )}

               <Button 
                type="submit" 
                className="w-full h-12 bg-white hover:bg-zinc-200 text-black font-black text-sm tracking-widest rounded-xl mt-4 shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-all hover:scale-[1.02]"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></div>
                ) : (
                  "START"
                )}
              </Button>
             </form>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
