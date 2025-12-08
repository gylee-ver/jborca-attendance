"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Trophy, TrendingUp, Plus, History, Award, User as UserIcon, ChevronDown, ChevronUp } from "lucide-react"
import { pointService, type User, type PointLog, supabase } from "@/lib/supabase"

// 기획안 기반 포인트 항목 정의
const POINT_RULES = {
  participation: [
    { label: "경기 출석", point: 10 },
    { label: "팀 훈련 참여", point: 15 },
    { label: "지각 (60분 이상)", point: -5 },
    { label: "무단 결석", point: -20 },
    { label: "미투표", point: -7 },
  ],
  game: [
    { label: "경기 MVP", point: 10 },
    { label: "멀티 출루 (안타/볼넷/사구)", point: 3 },
    { label: "타점 3점 이상", point: 3 },
    { label: "도루 성공", point: 1 },
    { label: "팀 승리 (전원)", point: 5 },
    { label: "투수 세 타자 연속 범퇴", point: 15 },
    { label: "수비 실책/본헤드", point: -3 },
    { label: "밀어내기 볼넷", point: -3 },
    { label: "지시 무시", point: -10 },
  ],
  team: [
    { label: "팀 행사 참여", point: 15 },
    { label: "콘텐츠 제작/제공", point: 5 },
    { label: "실무 지원 (장비/리서치)", point: 10 },
    { label: "장비 정리/운반", point: 3 },
    { label: "영상/사진 촬영 제공", point: 5 },
  ],
  penalty: [
    { label: "불성실 태도", point: -10 },
    { label: "무단결석 3회 누적", point: -5 },
    { label: "불필요한 언행", point: -7 },
    { label: "팀 분위기 저해", point: -20 },
  ]
}

export default function PointSystem({ user }: { user: User }) {
  const [logs, setLogs] = useState<PointLog[]>([])
  const [ranking, setRanking] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [showAllRankings, setShowAllRankings] = useState(false)
  
  // 관리자 기능용 상태
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [targetUserId, setTargetUserId] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("participation")
  const [selectedReason, setSelectedReason] = useState("")
  const [customReason, setCustomReason] = useState("")
  const [customPoint, setCustomPoint] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isAdmin = user.role === 'manager'

  const fetchData = async () => {
    try {
      setIsLoading(true)
      
      // 내 포인트 내역
      const { data: logData } = await pointService.getPointLogs(user.id)
      if (logData) setLogs(logData)

      // 랭킹
      const { data: rankData } = await pointService.getRanking()
      if (rankData) setRanking(rankData)

      // 전체 유저 목록 (항상 로드 - 포인트 부여 대상)
      const { data: allUsersData } = await pointService.getAllUsers()
      if (allUsersData) setAllUsers(allUsersData)

    } catch (error) {
      console.error('포인트 데이터 로딩 실패:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [user.id])

  const handleAddPoint = async () => {
    if (!targetUserId) {
      alert("대상 선수를 선택해주세요.")
      return
    }

    let reason = selectedReason
    let point = 0

    // 직접 입력인 경우
    if (selectedCategory === "custom") {
      if (!customReason || !customPoint) {
        alert("사유와 점수를 입력해주세요.")
        return
      }
      reason = customReason
      point = parseInt(customPoint)
    } else {
      // 규칙 선택인 경우
      if (!selectedReason) {
        alert("항목을 선택해주세요.")
        return
      }
      // 선택된 규칙에서 점수 찾기
      const categoryRules = POINT_RULES[selectedCategory as keyof typeof POINT_RULES]
      const rule = categoryRules?.find(r => r.label === selectedReason)
      if (rule) {
        point = rule.point
      }
    }

    setIsSubmitting(true)
    try {
      const { success, error } = await pointService.addPointLog(
        targetUserId,
        user.id, // admin_id
        selectedCategory === "custom" ? "participation" : selectedCategory,
        reason,
        point
      )

      if (success) {
        alert("포인트가 반영되었습니다.")
        setIsDialogOpen(false)
        fetchData()
        // 초기화
        setTargetUserId("")
        setSelectedCategory("participation")
        setSelectedReason("")
        setCustomReason("")
        setCustomPoint("")
      } else {
        alert(error || "오류가 발생했습니다.")
      }
    } catch (error) {
      console.error(error)
      alert("오류가 발생했습니다.")
    } finally {
      setIsSubmitting(false)
    }
  }

  // 현재 나의 랭킹 찾기
  const myRank = ranking.findIndex(u => u.id === user.id) + 1

  return (
    <div className="space-y-6">
      {/* 1. 내 포인트 카드 - Gold Color Theme */}
      <div className="bg-gradient-to-br from-yellow-950/20 to-zinc-900 border border-yellow-900/20 rounded-xl p-6 text-center relative overflow-hidden shadow-lg group">
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent pointer-events-none group-hover:opacity-100 transition-opacity" />
        <div className="absolute -right-4 -bottom-4 opacity-5 pointer-events-none rotate-12 group-hover:opacity-10 transition-opacity duration-500">
          <Trophy className="w-32 h-32 text-yellow-500" />
        </div>
        
        <div className="relative z-10">
          <p className="text-zinc-500 text-xs tracking-widest font-bold mb-2">2026 SEASON POINTS</p>
          <div className="text-5xl font-black text-white tracking-tighter flex justify-center items-baseline gap-2 drop-shadow-sm">
            {user.total_points || 0}
            <span className="text-lg font-bold text-yellow-500/80">PTS</span>
          </div>
          
          {/* 랭킹 배지 */}
          <div className="mt-4 inline-flex items-center gap-2 bg-white text-black px-4 py-1.5 rounded-full shadow-lg shadow-white/10">
            <Trophy className="w-3.5 h-3.5 text-yellow-600 fill-yellow-600" />
            <span className="text-xs font-bold">
              전체 {ranking.length}명 중 {myRank}위
            </span>
          </div>
        </div>
      </div>

      {/* 2. 관리자 기능 */}
      {isAdmin && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full bg-white text-black hover:bg-zinc-200 font-bold h-12 rounded-xl">
              <Plus className="w-4 h-4 mr-2" /> 포인트 부여/차감 (관리자)
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>포인트 관리</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>대상 선수</Label>
                <Select value={targetUserId} onValueChange={setTargetUserId}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700">
                    <SelectValue placeholder="선수 선택" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    {allUsers.map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} ({u.number}) - {u.role === 'manager' ? u.tag : '선수'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>카테고리</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    <SelectItem value="participation">참여도</SelectItem>
                    <SelectItem value="game">경기 기여</SelectItem>
                    <SelectItem value="team">팀 기여</SelectItem>
                    <SelectItem value="penalty">감점/패널티</SelectItem>
                    <SelectItem value="custom">직접 입력</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedCategory !== "custom" ? (
                <div className="space-y-2">
                  <Label>항목 선택</Label>
                  <Select value={selectedReason} onValueChange={setSelectedReason}>
                    <SelectTrigger className="bg-zinc-800 border-zinc-700">
                      <SelectValue placeholder="항목을 선택하세요" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-800 border-zinc-700">
                      {POINT_RULES[selectedCategory as keyof typeof POINT_RULES]?.map((rule, idx) => (
                        <SelectItem key={idx} value={rule.label}>
                          {rule.label} ({rule.point > 0 ? `+${rule.point}` : rule.point})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>사유</Label>
                    <Input 
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      className="bg-zinc-800 border-zinc-700"
                      placeholder="예: 특별 보너스"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>점수 (음수 가능)</Label>
                    <Input 
                      type="number"
                      value={customPoint}
                      onChange={(e) => setCustomPoint(e.target.value)}
                      className="bg-zinc-800 border-zinc-700"
                      placeholder="예: 10"
                    />
                  </div>
                </>
              )}

              <Button 
                onClick={handleAddPoint} 
                disabled={isSubmitting}
                className="w-full bg-white text-black hover:bg-zinc-200 font-bold mt-4"
              >
                {isSubmitting ? "처리 중..." : "반영하기"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* 3. 랭킹 및 내역 탭 */}
      <Tabs defaultValue="ranking" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-zinc-900 p-1 rounded-xl h-12">
          <TabsTrigger 
            value="ranking"
            className="rounded-lg font-bold data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-500"
          >
            <Trophy className="w-4 h-4 mr-2" /> 랭킹
          </TabsTrigger>
          <TabsTrigger 
            value="history"
            className="rounded-lg font-bold data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-500"
          >
            <History className="w-4 h-4 mr-2" /> 내역
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ranking" className="mt-4 space-y-2">
          {ranking.slice(0, showAllRankings ? undefined : 5).map((rankUser, index) => (
            <div 
              key={rankUser.id} 
              className={`flex items-center justify-between p-4 rounded-xl border ${
                rankUser.id === user.id 
                  ? "bg-zinc-900 border-zinc-700 ring-1 ring-zinc-700" 
                  : "bg-transparent border-zinc-800"
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shadow-md ${
                  index === 0 ? "bg-gradient-to-br from-yellow-300 to-yellow-600 text-black shadow-yellow-900/40" :
                  index === 1 ? "bg-gradient-to-br from-slate-300 to-slate-500 text-black shadow-slate-900/40" :
                  index === 2 ? "bg-gradient-to-br from-orange-400 to-orange-700 text-white shadow-orange-900/40" :
                  "bg-zinc-800 text-zinc-500"
                }`}>
                  {index + 1}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className={`font-bold ${rankUser.id === user.id ? "text-white" : "text-zinc-300"}`}>
                      {rankUser.name}
                    </p>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-zinc-700 text-zinc-500">
                      {rankUser.number}
                    </Badge>
                  </div>
                  {rankUser.role === 'manager' && (
                    <p className="text-xs text-zinc-500 mt-0.5">{rankUser.tag}</p>
                  )}
                </div>
              </div>
              <div className="font-mono font-bold text-zinc-400">
                {rankUser.total_points || 0} P
              </div>
            </div>
          ))}
          
          {ranking.length > 5 && (
            <Button 
              variant="ghost" 
              className="w-full text-zinc-500 hover:text-white text-xs py-4 mt-2 h-auto hover:bg-zinc-800/50"
              onClick={() => setShowAllRankings(!showAllRankings)}
            >
              {showAllRankings ? (
                <span className="flex items-center gap-1">접기 <ChevronUp className="w-3 h-3" /></span>
              ) : (
                <span className="flex items-center gap-1">더보기 ({ranking.length - 5}명) <ChevronDown className="w-3 h-3" /></span>
              )}
            </Button>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4 space-y-3">
          {logs.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 text-sm">
              아직 포인트 내역이 없습니다.
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="flex justify-between items-start p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors">
                <div className="space-y-1">
                  <p className="font-bold text-zinc-300">{log.reason}</p>
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span>{new Date(log.created_at).toLocaleDateString()}</span>
                    <span className="w-1 h-1 bg-zinc-700 rounded-full"></span>
                    <span className="capitalize">{
                      log.category === 'participation' ? '참여' :
                      log.category === 'game' ? '경기' :
                      log.category === 'team' ? '팀' :
                      '기타'
                    }</span>
                  </div>
                </div>
                <div className={`font-black text-lg ${log.points > 0 ? "text-blue-500" : "text-red-500"}`}>
                  {log.points > 0 ? "+" : ""}{log.points}
                </div>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
