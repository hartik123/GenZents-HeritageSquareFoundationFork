"use client"

import { useState, useEffect, useCallback } from "react"
import { TaskManager } from "@/components/tasks/task-manager"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Activity, Clock, CheckCircle, XCircle } from "lucide-react"
import { useTaskStore } from "@/lib/stores/task-store"

export default function TasksPage() {
  const { tasks, taskStats, fetchTasks, fetchTaskStats } = useTaskStore()

  useEffect(() => {
    fetchTasks()
    fetchTaskStats()

    // Poll for updates every 5 seconds
    const interval = setInterval(() => {
      fetchTasks()
      fetchTaskStats()
    }, 5000)

    return () => clearInterval(interval)
  }, [fetchTasks, fetchTaskStats])

  return (
    <div className="h-full overflow-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Task Manager</h1>
          <p className="text-muted-foreground">Monitor and manage your long-running tasks</p>
        </div>

        {/* Task Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
              <Activity className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{taskStats.running}</div>
              <p className="text-xs text-muted-foreground">Currently running</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{taskStats.pending}</div>
              <p className="text-xs text-muted-foreground">Waiting to start</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{taskStats.completed}</div>
              <p className="text-xs text-muted-foreground">Successfully finished</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{taskStats.failed}</div>
              <p className="text-xs text-muted-foreground">Encountered errors</p>
            </CardContent>
          </Card>
        </div>

        {/* Task List */}
        <TaskManager />
      </div>
    </div>
  )
}
