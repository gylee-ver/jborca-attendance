"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Trophy, Users, ChevronDown, ChevronUp } from "lucide-react"
import { statsService, type UserWithStats } from "@/lib/supabase"

interface AttendanceRankingProps {
  onTeamAttendanceClick?: () => void
}

export default function AttendanceRanking({ onTeamAttendanceClick }: AttendanceRankingProps) {
  const [topPlayers, setTopPlayers] = useState<UserWithStats[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    const fetchRankingData = async () => {
      try {
        const allPlayers = await statsService.getAllUserStats(2025)
        setTopPlayers(allPlayers.filter(player => player.stats && player.stats.total_events > 0))
      } catch (error) {
        console.error('랭킹 데이터 로딩 오류:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchRankingData()
  }, [])

  const getRankStyle = (rank: number) => {
    switch (rank) {
      case 1: return "bg-gradient-to-br from-yellow-300 to-yellow-600 text-black ring-2 ring-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.4)]" // Gold
      case 2: return "bg-gradient-to-br from-slate-300 to-slate-500 text-black ring-2 ring-slate-400/50"   // Silver
      case 3: return "bg-gradient-to-br from-orange-400 to-orange-700 text-white ring-2 ring-orange-500/50" // Bronze
      default: return "bg-zinc-800 text-zinc-400"
    }
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800 shadow-none relative overflow-hidden">
      <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
        <Trophy className="w-32 h-32 rotate-12" />
      </div>
      <CardHeader className="pb-4 relative z-10">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center space-x-2 text-lg font-black italic tracking-tight">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <span>TOP PLAYERS</span>
          </CardTitle>
          {onTeamAttendanceClick && (
            <Button
              onClick={onTeamAttendanceClick}
              size="sm"
              variant="ghost"
              className="text-zinc-500 hover:text-white text-xs h-8"
            >
              <Users className="w-4 h-4 mr-1" />
              전체 보기
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="relative z-10">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mx-auto"></div>
            <p className="text-zinc-500 mt-2 text-xs">랭킹 로딩 중...</p>
          </div>
        ) : topPlayers.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-zinc-800 rounded-xl">
            <Trophy className="w-10 h-10 text-zinc-700 mx-auto mb-2" />
            <p className="text-zinc-500 text-sm">출석 데이터가 없습니다</p>
          </div>
        ) : (
          <div className="space-y-3">
            {topPlayers.slice(0, showAll ? 10 : 5).map((player, index) => {
              const rank = index + 1
              const attendanceRate = player.stats?.attendance_rate || 0
              
              return (
                <div key={player.id} className="flex items-center justify-between p-3 bg-black/50 border border-zinc-800 rounded-xl backdrop-blur-sm hover:border-zinc-700 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shadow-lg ${getRankStyle(rank)}`}>
                      {rank}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-bold text-sm">{player.name}</span>
                        <span className="text-zinc-600 text-xs font-medium">#{player.number}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-[10px] h-4 px-1 py-0 border-zinc-800 text-zinc-500 bg-zinc-900">
                          {player.position || '선수'}
                        </Badge>
                        {player.role === 'manager' && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1 py-0 border-zinc-800 text-zinc-500 bg-zinc-900">
                            {player.tag}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-white font-black text-lg tracking-tight">{attendanceRate}%</span>
                    <p className="text-[10px] text-zinc-600 font-medium">
                      {player.stats?.attended_events}회 출석
                    </p>
                  </div>
                </div>
              )
            })}
            
            {topPlayers.length > 5 && (
              <Button 
                variant="ghost" 
                className="w-full text-zinc-500 hover:text-white text-xs py-2 h-auto hover:bg-zinc-800/50"
                onClick={() => setShowAll(!showAll)}
              >
                {showAll ? (
                  <span className="flex items-center gap-1">접기 <ChevronUp className="w-3 h-3" /></span>
                ) : (
                  <span className="flex items-center gap-1">TOP 10 더보기 <ChevronDown className="w-3 h-3" /></span>
                )}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
