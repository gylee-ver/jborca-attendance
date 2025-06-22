"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Trophy, Medal, Award, Users } from "lucide-react"
import { statsService, type UserWithStats } from "@/lib/supabase"

interface AttendanceRankingProps {
  onTeamAttendanceClick?: () => void
}

export default function AttendanceRanking({ onTeamAttendanceClick }: AttendanceRankingProps) {
  const [topPlayers, setTopPlayers] = useState<UserWithStats[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchRankingData = async () => {
      try {
        const allPlayers = await statsService.getAllUserStats(2025)
        // 출석률 상위 10명만 표시
        const topTen = allPlayers
          .filter(player => player.stats && player.stats.total_events > 0)
          .slice(0, 10)
        setTopPlayers(topTen)
      } catch (error) {
        console.error('랭킹 데이터 로딩 오류:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchRankingData()
  }, [])

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-5 h-5 text-yellow-500" />
      case 2:
        return <Medal className="w-5 h-5 text-gray-400" />
      case 3:
        return <Award className="w-5 h-5 text-amber-600" />
      default:
        return <span className="w-5 h-5 text-center text-sm font-bold text-gray-400">{rank}</span>
    }
  }

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return "bg-yellow-900/30 border-yellow-700"
      case 2:
        return "bg-gray-900/30 border-gray-600"
      case 3:
        return "bg-amber-900/30 border-amber-700"
      default:
        return "bg-gray-800"
    }
  }

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center space-x-2">
            <Trophy className="w-5 h-5" />
            <span>출석 랭킹</span>
          </CardTitle>
          {onTeamAttendanceClick && (
            <Button
              onClick={onTeamAttendanceClick}
              size="sm"
              className="bg-gray-800 hover:bg-gray-700 text-white text-xs px-3 py-1 h-8"
            >
              <Users className="w-4 h-4 mr-1" />
              전체 현황
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
            <p className="text-gray-400 mt-2">랭킹 데이터 로딩 중...</p>
          </div>
        ) : topPlayers.length === 0 ? (
          <div className="text-center py-8">
            <Trophy className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400">출석 데이터가 없습니다</p>
          </div>
        ) : (
          <div className="space-y-3">
            {topPlayers.map((player, index) => {
              const rank = index + 1
              const attendanceRate = player.stats?.attendance_rate || 0
              const attendedEvents = player.stats?.attended_events || 0
              const totalEvents = player.stats?.total_events || 0

              return (
                <div
                  key={player.id}
                  className={`p-3 rounded-lg border ${getRankColor(rank)} ${
                    rank <= 3 ? 'border' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getRankIcon(rank)}
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-white">
                            #{player.number} {player.name}
                          </span>
                          {player.role === "manager" && (
                            <Badge className="bg-purple-600 text-white text-xs">
                              매니저
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-gray-400">
                          {attendedEvents}/{totalEvents} 참석
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-white">
                        {attendanceRate}%
                      </div>
                      <div className="text-xs text-gray-400">출석률</div>
                    </div>
                  </div>
                  
                  {/* 출석률 진행바 */}
                  <div className="mt-2">
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          rank === 1
                            ? 'bg-yellow-500'
                            : rank === 2
                            ? 'bg-gray-400'
                            : rank === 3
                            ? 'bg-amber-600'
                            : 'bg-blue-500'
                        }`}
                        style={{ width: `${attendanceRate}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
