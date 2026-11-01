import { Card } from "./card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
  onClick?: () => void;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  className,
  onClick,
}: StatCardProps) {
  return (
    <Card 
      className={cn("p-4 sm:p-6 hover:shadow-lg transition-all duration-300 animate-fade-in", className)}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground leading-snug">{title}</p>
          <h3 className="text-2xl sm:text-3xl font-bold mt-2 leading-none">{value}</h3>
          {description && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-2 leading-snug">{description}</p>
          )}
          {trend && (
            <div className="flex items-center mt-2 text-sm">
              <span
                className={cn(
                  "font-medium",
                  trend.isPositive ? "text-green-600" : "text-red-600"
                )}
              >
                {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
              </span>
              <span className="text-muted-foreground ml-1">vs last term</span>
            </div>
          )}
        </div>
        <div className="shrink-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          </div>
        </div>
      </div>
    </Card>
  );
}
