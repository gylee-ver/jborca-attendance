"use client"

import type React from "react"
import Image from "next/image"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { User, Shield, Users } from "lucide-react"
import { authService, type User as UserType } from "@/lib/supabase"
import Dashboard from "./dashboard/page"

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [user, setUser] = useState<UserType | null>(null)
  const [isSignUp, setIsSignUp] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    number: "",
    role: "player" as "player" | "manager",
    position: "",
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
        setFormData({ name: "", number: "", role: "player", position: "" })
      }
    } catch (err) {
      setError("로그인 중 오류가 발생했습니다.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    if (!formData.name.trim() || !formData.number.trim()) {
      setError("이름과 등번호를 입력해주세요.")
      setIsLoading(false)
      return
    }

    try {
      const { user: userData, error: signUpError } = await authService.signUp(
        formData.name.trim(),
        formData.number.trim(),
        formData.role,
        formData.position.trim() || undefined
      )

      if (signUpError) {
        setError(signUpError)
        return
      }

      if (userData) {
        setUser(userData)
        setIsLoggedIn(true)
        localStorage.setItem("jb-orca-user", JSON.stringify(userData))
        
        // 폼 초기화
        setFormData({ name: "", number: "", role: "player", position: "" })
      }
    } catch (err) {
      setError("회원가입 중 오류가 발생했습니다.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = () => {
    setIsLoggedIn(false)
    setUser(null)
    localStorage.removeItem("jb-orca-user")
  }

  const handleNumberChange = async (value: string) => {
    setFormData({ ...formData, number: value })
    
    // 회원가입 모드에서 등번호 중복 확인
    if (isSignUp && value.trim()) {
      const isAvailable = await authService.checkNumberAvailability(value.trim())
      if (!isAvailable) {
        setError("이미 사용 중인 등번호입니다.")
      } else {
        setError(null)
      }
    }
  }

  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 relative animate-pulse mx-auto mb-4">
            <Image
              src="/JB_Logo_White.png"
              alt="JB ORCA 로고"
              fill
              className="object-contain"
            />
          </div>
          <div className="flex space-x-1 justify-center">
            <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
            <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
          </div>
        </div>
      </div>
    )
  }

  if (isLoggedIn && user) {
    return <Dashboard user={user} onLogout={handleLogout} />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="bg-gray-900/95 border-gray-700 shadow-2xl backdrop-blur-sm">
          <CardHeader className="text-center pb-6">
            {/* 로고 섹션 */}
            <div className="flex items-center justify-center mb-6">
              <div className="w-20 h-20 relative p-2 bg-gray-800 rounded-full">
                <Image
                  src="/JB_Logo_White.png"
                  alt="JB ORCA 로고"
                  fill
                  className="object-contain"
                />
              </div>
            </div>
            
            {/* 타이틀 */}
            <CardTitle className="text-3xl font-bold text-white mb-2">
              JB ORCA
            </CardTitle>
            <CardDescription className="text-gray-400 text-base">
              출석 관리 시스템
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* 모드 전환 버튼 */}
            <div className="flex bg-gray-800 rounded-lg p-1">
              <Button 
                variant={!isSignUp ? "default" : "ghost"} 
                onClick={() => {
                  setIsSignUp(false)
                  setError(null)
                  setFormData({ name: "", number: "", role: "player", position: "" })
                }} 
                className={`flex-1 h-10 ${!isSignUp ? 'bg-blue-600 hover:bg-blue-700' : 'hover:bg-gray-700'}`}
              >
                <User className="w-4 h-4 mr-2" />
                로그인
              </Button>
              <Button 
                variant={isSignUp ? "default" : "ghost"} 
                onClick={() => {
                  setIsSignUp(true)
                  setError(null)
                  setFormData({ name: "", number: "", role: "player", position: "" })
                }} 
                className={`flex-1 h-10 ${isSignUp ? 'bg-green-600 hover:bg-green-700' : 'hover:bg-gray-700'}`}
              >
                <Users className="w-4 h-4 mr-2" />
                회원가입
              </Button>
            </div>

            {/* 에러 메시지 */}
            {error && (
              <div className="p-4 bg-red-900/40 border border-red-700/50 rounded-lg backdrop-blur-sm">
                <p className="text-red-300 text-sm font-medium">⚠️ {error}</p>
              </div>
            )}

            {/* 로그인/회원가입 폼 */}
            <form onSubmit={isSignUp ? handleSignUp : handleLogin} className="space-y-5">
              {/* 이름 입력 */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-white font-medium flex items-center">
                  <User className="w-4 h-4 mr-2" />
                  이름
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="실명을 입력하세요"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 h-12 focus:border-blue-500 focus:ring-blue-500"
                  required
                  disabled={isLoading}
                />
              </div>

              {/* 등번호 입력 */}
              <div className="space-y-2">
                <Label htmlFor="number" className="text-white font-medium flex items-center">
                  <div className="w-4 h-4 mr-2 border border-white rounded text-xs flex items-center justify-center text-white">
                    #
                  </div>
                  등번호
                </Label>
                <Input
                  id="number"
                  type="text"
                  placeholder="등번호를 입력하세요"
                  value={formData.number}
                  onChange={(e) => handleNumberChange(e.target.value)}
                  className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 h-12 focus:border-blue-500 focus:ring-blue-500"
                  required
                  disabled={isLoading}
                />
              </div>

              {/* 회원가입 전용 필드 */}
              {isSignUp && (
                <div className="space-y-5 pt-2">
                  {/* 역할 선택 */}
                  <div className="space-y-2">
                    <Label htmlFor="role" className="text-white font-medium flex items-center">
                      <Shield className="w-4 h-4 mr-2" />
                      역할
                    </Label>
                    <Select
                      value={formData.role}
                      onValueChange={(value: "player" | "manager") => setFormData({ ...formData, role: value })}
                      disabled={isLoading}
                    >
                      <SelectTrigger className="bg-gray-800 border-gray-600 text-white h-12 focus:border-blue-500">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-600">
                        <SelectItem value="player" className="text-white hover:bg-gray-700">
                          ⚾ 선수
                        </SelectItem>
                        <SelectItem value="manager" className="text-white hover:bg-gray-700">
                          📋 매니저
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* 제출 버튼 */}
              <Button 
                type="submit" 
                className={`w-full h-12 font-semibold text-white transition-all duration-200 ${
                  isSignUp 
                    ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500' 
                    : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    처리 중...
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    {isSignUp ? <Users className="w-5 h-5 mr-2" /> : <User className="w-5 h-5 mr-2" />}
                    {isSignUp ? "팀에 가입하기" : "로그인"}
                  </div>
                )}
              </Button>
            </form>

            {/* 회원가입 안내 메시지만 표시 */}
            {isSignUp && (
              <div className="text-center">
                <div className="p-4 bg-green-900/30 border border-green-700/50 rounded-lg">
                  <p className="text-green-200 text-sm font-medium mb-2">
                    🎾 새로운 팀 멤버
                  </p>
                  <p className="text-green-300 text-xs">
                    선수 또는 매니저로 팀에 가입하세요
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
