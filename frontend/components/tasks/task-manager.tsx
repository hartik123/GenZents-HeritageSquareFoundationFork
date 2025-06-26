"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Activity, Clock, CheckCircle, XCircle, AlertCircle, MoreHorizontal, Square, Trash2, Eye } from "lucide-react"
import { useTaskStore } from "@/lib/stores/task-store"
import type { Task, TaskStatus, TaskType, TaskManagerProps } from "@/lib/types/tasks"
import { formatDistanceToNow } from "date-fns"

export function TaskManager() {
  const { tasks, loading, error, cancelTask, deleteTask, subscribeToTasks } = useTaskStore()

  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  // Subscribe to real-time updates
  useEffect(() => {
    const unsubscribe = subscribeToTasks()
    return unsubscribe
  }, [subscribeToTasks])

  const filteredTasks = tasks.filter((task) => {
    if (statusFilter !== "all" && task.status !== statusFilter) return false
    if (typeFilter !== "all" && task.type !== typeFilter) return false
    return true
  })

  const getStatusIcon = (status: Task["status"]) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />
      case "running":
        return <Activity className="h-4 w-4 text-blue-500 animate-pulse" />
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />
      case "cancelled":
        return <AlertCircle className="h-4 w-4 text-gray-500" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  const getStatusColor = (status: Task["status"]) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "running":
        return "bg-blue-100 text-blue-800"
      case "completed":
        return "bg-green-100 text-green-800"
      case "failed":
        return "bg-red-100 text-red-800"
      case "cancelled":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const handleCancelTask = async (taskId: string) => {
    await cancelTask(taskId)
  }

  const handleDeleteTask = async (taskId: string) => {
    await deleteTask(taskId)
  }

  const TaskCard = ({ task }: { task: Task }) => (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon(task.status)}
            <CardTitle className="text-lg">{task.command}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={getStatusColor(task.status)}>{task.status}</Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSelectedTask(task)}>
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </DropdownMenuItem>
                {(task.status === "pending" || task.status === "running") && (
                  <DropdownMenuItem onClick={() => handleCancelTask(task.id)}>
                    <Square className="mr-2 h-4 w-4" />
                    Cancel Task
                  </DropdownMenuItem>
                )}
                {(task.status === "completed" || task.status === "failed" || task.status === "cancelled") && (
                  <DropdownMenuItem onClick={() => handleDeleteTask(task.id)} className="text-red-600">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Task
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <CardDescription className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1">
            Type: <Badge variant="outline">{task.type}</Badge>
          </span>
          <span>Priority: {task.priority}</span>
          <span>Created {formatDistanceToNow(new Date(task.created_at))} ago</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {task.status === "running" && (
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span>Progress</span>
              <span>{task.progress}%</span>
            </div>
            <Progress value={task.progress} className="h-2" />
          </div>
        )}

        {task.logs && task.logs.length > 0 && (
          <div className="space-y-1">
            <Label className="text-sm font-medium">Recent Activity:</Label>
            <div className="text-xs text-muted-foreground">
              {task.logs.slice(-2).map((log, index) => (
                <div key={index}>{log}</div>
              ))}
            </div>
          </div>
        )}

        {task.error_message && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
            <p className="text-sm text-red-600">{task.error_message}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="organize">Organize</SelectItem>
              <SelectItem value="search">Search</SelectItem>
              <SelectItem value="cleanup">Cleanup</SelectItem>
              <SelectItem value="backup">Backup</SelectItem>
              <SelectItem value="analysis">Analysis</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Task List */}
      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="text-center py-8">
            <div className="inline-flex items-center gap-2">
              <Activity className="h-4 w-4 animate-spin" />
              Loading tasks...
            </div>
          </div>
        ) : error ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-red-600">Error loading tasks: {error}</div>
            </CardContent>
          </Card>
        ) : filteredTasks.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-muted-foreground">
                No tasks found. Tasks are created through chat commands.
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredTasks.map((task) => <TaskCard key={task.id} task={task} />)
        )}
      </div>

      {/* Task Detail Dialog */}
      {selectedTask && (
        <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {getStatusIcon(selectedTask.status)}
                Task Details
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Command</Label>
                  <p className="text-sm">{selectedTask.command}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Type</Label>
                  <Badge variant="outline">{selectedTask.type}</Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium">Status</Label>
                  <Badge className={getStatusColor(selectedTask.status)}>{selectedTask.status}</Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium">Progress</Label>
                  <p className="text-sm">{selectedTask.progress}%</p>
                </div>
              </div>

              {selectedTask.status === "running" && (
                <div>
                  <Label className="text-sm font-medium">Progress</Label>
                  <Progress value={selectedTask.progress} className="mt-1" />
                </div>
              )}

              {selectedTask.logs && selectedTask.logs.length > 0 && (
                <div>
                  <Label className="text-sm font-medium">Logs</Label>
                  <ScrollArea className="h-32 w-full border rounded p-2 mt-1">
                    {selectedTask.logs.map((log, index) => (
                      <div key={index} className="text-xs text-muted-foreground mb-1">
                        {log}
                      </div>
                    ))}
                  </ScrollArea>
                </div>
              )}

              {selectedTask.result && (
                <div>
                  <Label className="text-sm font-medium">Result</Label>
                  <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto">
                    {JSON.stringify(selectedTask.result, null, 2)}
                  </pre>
                </div>
              )}

              {selectedTask.error_message && (
                <div>
                  <Label className="text-sm font-medium">Error</Label>
                  <div className="p-2 bg-red-50 border border-red-200 rounded mt-1">
                    <p className="text-sm text-red-600">{selectedTask.error_message}</p>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
