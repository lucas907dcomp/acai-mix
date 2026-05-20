import { TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: React.ReactNode
  trend?: { value: number; direction: 'up' | 'down' | 'neutral' }
  isLoading?: boolean
}

export function MetricCard({ title, value, subtitle, icon, trend, isLoading }: MetricCardProps) {
  if (isLoading) {
    return (
      <Card className="bg-[#1a0b2e] border-[#2d1550]">
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-3 w-20" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-[#1a0b2e] border-[#2d1550]">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-[#9d7bc8]">{title}</CardTitle>
        {icon && <span className="text-[#9d7bc8]">{icon}</span>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-white">{value}</div>
        <div className="flex items-center gap-1 mt-1">
          {trend && (
            <span
              className={
                trend.direction === 'up'
                  ? 'text-green-400'
                  : trend.direction === 'down'
                    ? 'text-red-400'
                    : 'text-[#9d7bc8]'
              }
            >
              {trend.direction === 'up' ? (
                <TrendingUp className="w-3 h-3 inline" />
              ) : trend.direction === 'down' ? (
                <TrendingDown className="w-3 h-3 inline" />
              ) : (
                <Minus className="w-3 h-3 inline" />
              )}
              <span className="text-xs ml-0.5">{Math.abs(trend.value).toFixed(1)}%</span>
            </span>
          )}
          {subtitle && <span className="text-xs text-[#9d7bc8]">{subtitle}</span>}
        </div>
      </CardContent>
    </Card>
  )
}
