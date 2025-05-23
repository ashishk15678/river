import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function CreateRoomModal({
  isOpen,
  setIsOpen,
}: {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [scheduleTime, setScheduleTime] = useState<Date>();
  const [duration, setDuration] = useState("60"); // Default 60 minutes
  const [showCalendar, setShowCalendar] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Generate time slots in 15-minute intervals
  const timeSlots = Array.from({ length: 24 * 4 }, (_, i) => {
    const hour = Math.floor(i / 4);
    const minute = (i % 4) * 15;
    return `${hour.toString().padStart(2, "0")}:${minute
      .toString()
      .padStart(2, "0")}`;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleTime) return;

    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          scheduleTime,
          duration: parseInt(duration),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create room");
      }

      setIsOpen(false);
      // Reset form
      setName("");
      setScheduleTime(undefined);
      setDuration("60");
      setShowCalendar(false);
      setShowTimePicker(false);
    } catch (error) {
      console.error("Error creating room:", error);
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      const newDate = new Date(date);
      if (scheduleTime) {
        // Preserve the time from the previous selection
        newDate.setHours(scheduleTime.getHours(), scheduleTime.getMinutes());
      } else {
        // Set to current time if no time was selected before
        const now = new Date();
        newDate.setHours(now.getHours(), now.getMinutes());
      }
      setScheduleTime(newDate);
    }
    setShowCalendar(false);
  };

  const handleTimeSelect = (time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    if (scheduleTime) {
      const newDate = new Date(scheduleTime);
      newDate.setHours(hours, minutes);
      setScheduleTime(newDate);
    } else {
      // If no date is selected, create a new date for today
      const newDate = new Date();
      newDate.setHours(hours, minutes);
      setScheduleTime(newDate);
    }
    setShowTimePicker(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Schedule New Recording</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Recording Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter recording name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Schedule Time</Label>
            <div className="grid gap-2">
              <div className="relative">
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !scheduleTime && "text-muted-foreground"
                  )}
                  onClick={() => setShowCalendar(!showCalendar)}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {scheduleTime ? (
                    format(scheduleTime, "PPP p")
                  ) : (
                    <span>Pick a date and time</span>
                  )}
                </Button>

                {showCalendar && (
                  <div className="absolute z-50 mt-1 rounded-md border bg-popover p-3 shadow-md">
                    <Calendar
                      mode="single"
                      selected={scheduleTime}
                      onSelect={handleDateSelect}
                      initialFocus
                      disabled={(date) => date < new Date()}
                    />
                    <div className="mt-2 border-t pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                        onClick={() => setShowTimePicker(!showTimePicker)}
                      >
                        <Clock className="mr-2 h-4 w-4" />
                        {scheduleTime
                          ? format(scheduleTime, "HH:mm")
                          : "Select time"}
                      </Button>

                      {showTimePicker && (
                        <div className="absolute z-50 mt-1 w-[200px] rounded-md border bg-popover p-1 shadow-md">
                          <div className="grid grid-cols-2 gap-1 max-h-[200px] overflow-y-auto">
                            {timeSlots.map((time) => (
                              <Button
                                key={time}
                                type="button"
                                variant={
                                  scheduleTime &&
                                  format(scheduleTime, "HH:mm") === time
                                    ? "default"
                                    : "ghost"
                                }
                                className="justify-start font-normal h-8"
                                onClick={() => handleTimeSelect(time)}
                              >
                                {time}
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration">Duration (minutes)</Label>
            <Input
              id="duration"
              type="number"
              min="15"
              max="240"
              step="15"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              required
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsOpen(false);
                setShowCalendar(false);
                setShowTimePicker(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!scheduleTime}>
              Schedule Recording
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
