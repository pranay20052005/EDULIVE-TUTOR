import { useNavigate } from "@tanstack/react-router";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { fromDDMMYYYY, maskDOB, toDDMMYYYY } from "@/lib/format";
import { useTeacherSubjects } from "@/lib/db/hooks";
import { useSession } from "@/lib/session";
import { testService } from "@/lib/db";
import { cn } from "@/lib/utils";
import type { FacultyTest, QuestionType, TestQuestion } from "@/lib/db/types";

export interface BuilderQuestion {
  id: string;
  type: QuestionType;
  text: string;
  options: string[];
  answer: number | string;
  marks: number;
}

const emptyQuestion = (): BuilderQuestion => ({
  id: `local-${Math.random().toString(36).slice(2, 9)}`,
  type: "mcq",
  text: "",
  options: ["", "", "", ""],
  answer: 0,
  marks: 5,
});

interface FormErrors {
  title?: string;
  subjectId?: string;
  durationMin?: string;
  passingMarks?: string;
  startsAt?: string;
  endsAt?: string;
  questions?: string;
}

export function TestBuilder({ test }: { test: FacultyTest & { questions?: TestQuestion[] } }) {
  const { teacher } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: mySubjects = [] } = useTeacherSubjects(teacher.id);

  const initialQuestions: BuilderQuestion[] = useMemo(() => {
    if (test.questions && test.questions.length > 0) {
      return test.questions.map((q) => ({
        id: q.id,
        type: q.type,
        text: q.text,
        options: Array.isArray(q.options) ? q.options : ["", "", "", ""],
        answer: q.correct_answer_index ?? 0,
        marks: q.marks || 5,
      }));
    }
    return [emptyQuestion()];
  }, [test.questions]);

  const [title, setTitle] = useState(test.title || "");
  const [subjectId, setSubjectId] = useState(test.subject_id || mySubjects[0]?.id || "");
  const [description, setDescription] = useState(test.description || "");
  const [instructions, setInstructions] = useState(
    test.instructions || "All questions are compulsory. There is no negative marking.",
  );
  const [durationMin, setDurationMin] = useState(test.duration_min || 30);
  const [passingMarks, setPassingMarks] = useState(test.passing_marks || 40);
  const [startsAtStr, setStartsAtStr] = useState(
    test.starts_at
      ? toDDMMYYYY(test.starts_at.slice(0, 10))
      : toDDMMYYYY(new Date().toISOString().slice(0, 10)),
  );
  const [endsAtStr, setEndsAtStr] = useState(
    test.ends_at
      ? toDDMMYYYY(test.ends_at.slice(0, 10))
      : toDDMMYYYY(new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10)),
  );
  const [questions, setQuestions] = useState<BuilderQuestion[]>(initialQuestions);
  const [errors, setErrors] = useState<FormErrors>({});
  const [questionErrors, setQuestionErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const totalMarks = useMemo(
    () => questions.reduce((s, q) => s + (Number.isFinite(q.marks) ? q.marks : 0), 0),
    [questions],
  );

  const updateQuestion = (id: string, patch: Partial<BuilderQuestion>) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  };

  const changeType = (id: string, type: QuestionType) => {
    updateQuestion(id, {
      type,
      options: type === "truefalse" ? ["True", "False"] : type === "mcq" ? ["", "", "", ""] : [],
      answer: type === "short" ? "" : 0,
    });
  };

  const addQuestion = () => {
    setQuestions((prev) => [...prev, emptyQuestion()]);
  };

  const removeQuestion = (id: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const move = (index: number, dir: -1 | 1) => {
    setQuestions((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  };

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (!title.trim()) next.title = "Title is required.";
    if (!subjectId) next.subjectId = "Select a subject.";
    if (!durationMin || durationMin <= 0) next.durationMin = "Duration must be greater than 0.";
    const startIso = fromDDMMYYYY(startsAtStr);
    const endIso = fromDDMMYYYY(endsAtStr);
    if (!startIso) next.startsAt = "Enter a valid date (DD/MM/YYYY).";
    if (!endIso) next.endsAt = "Enter a valid date (DD/MM/YYYY).";
    if (startIso && endIso && endIso < startIso) next.endsAt = "End date must be after start date.";
    if (questions.length === 0) next.questions = "Add at least one question.";

    const qErrors: Record<string, string> = {};
    questions.forEach((q) => {
      if (!q.text.trim()) {
        qErrors[q.id] = "Question text is required.";
        return;
      }
      if (q.type === "short") {
        if (!String(q.answer).trim()) qErrors[q.id] = "Provide a model answer.";
      } else {
        if (q.options.some((o) => !o.trim())) {
          qErrors[q.id] = "All options must be filled in.";
          return;
        }
        if (typeof q.answer !== "number" || q.answer < 0 || q.answer >= q.options.length) {
          qErrors[q.id] = "Select the correct answer.";
        }
      }
    });

    setErrors(next);
    setQuestionErrors(qErrors);
    return Object.keys(next).length === 0 && Object.keys(qErrors).length === 0;
  };

  const save = async (status: "draft" | "published") => {
    if (!validate()) {
      toast.error("Please fix the highlighted errors before saving.");
      return;
    }
    setSaving(true);
    const startIso = fromDDMMYYYY(startsAtStr) ?? new Date().toISOString();
    const endIso = fromDDMMYYYY(endsAtStr) ?? new Date().toISOString();

    try {
      let testId = test.id;
      const isExisting = testId && !testId.startsWith("ft-") && !testId.startsWith("local-");

      if (isExisting) {
        await testService.update(testId, {
          title: title.trim(),
          subject_id: subjectId,
          description: description.trim(),
          instructions: instructions.trim(),
          duration_min: durationMin,
          total_marks: totalMarks,
          passing_marks: passingMarks,
          starts_at: startIso,
          ends_at: endIso,
          status,
        });
      } else {
        const created = await testService.create({
          teacher_id: teacher.id,
          subject_id: subjectId,
          title: title.trim(),
          description: description.trim(),
          instructions: instructions.trim(),
          duration_min: durationMin,
          total_marks: totalMarks,
          passing_marks: passingMarks,
          starts_at: startIso,
          ends_at: endIso,
          status,
        });
        testId = created.id;
      }

      // Save questions
      if (testId) {
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          if (q) {
            if (q.id && !q.id.startsWith("local-") && !q.id.startsWith("tq-")) {
              // Already exists in DB
            } else {
              await testService.createQuestion({
                test_id: testId,
                question_order: i + 1,
                type: q.type || "mcq",
                text: (q.text || "").trim(),
                options: q.type === "short" ? [] : q.options,
                correct_answer_index: typeof q.answer === "number" ? q.answer : 0,
                marks: q.marks || 1,
              });
            }
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ["teacher-tests"] });
      queryClient.invalidateQueries({ queryKey: ["tests"] });
      toast.success(status === "published" ? "Test published" : "Draft saved");
      navigate({ to: "/teacher/tests" });
    } catch (err: any) {
      console.error("Error saving test:", err);
      toast.error(err.message || "Failed to save test");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="surface space-y-4 p-5">
        <h2 className="text-base font-semibold">Test details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="tb-title">Title</Label>
            <Input id="tb-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            {errors.title ? <p className="text-xs text-destructive">{errors.title}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tb-subject">Subject</Label>
            <Select value={subjectId} onValueChange={(v) => setSubjectId(v)}>
              <SelectTrigger id="tb-subject">
                <SelectValue placeholder="Select subject" />
              </SelectTrigger>
              <SelectContent>
                {mySubjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} · {s.standard || "10th"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.subjectId ? (
              <p className="text-xs text-destructive">{errors.subjectId}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tb-duration">Duration (minutes)</Label>
            <Input
              id="tb-duration"
              type="number"
              min={1}
              value={durationMin}
              onChange={(e) => setDurationMin(Number(e.target.value))}
            />
            {errors.durationMin ? (
              <p className="text-xs text-destructive">{errors.durationMin}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tb-passing">Passing marks</Label>
            <Input
              id="tb-passing"
              type="number"
              min={0}
              value={passingMarks}
              onChange={(e) => setPassingMarks(Number(e.target.value))}
            />
            {errors.passingMarks ? (
              <p className="text-xs text-destructive">{errors.passingMarks}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label>Total marks</Label>
            <p className="flex h-9 items-center rounded-md border border-border bg-muted px-3 text-sm font-medium">
              {totalMarks} marks (auto-calculated)
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tb-starts">Starts on (DD/MM/YYYY)</Label>
            <Input
              id="tb-starts"
              inputMode="numeric"
              placeholder="DD/MM/YYYY"
              value={startsAtStr}
              onChange={(e) => setStartsAtStr(maskDOB(e.target.value))}
            />
            {errors.startsAt ? <p className="text-xs text-destructive">{errors.startsAt}</p> : null}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="tb-ends">Ends on (DD/MM/YYYY)</Label>
            <Input
              id="tb-ends"
              inputMode="numeric"
              placeholder="DD/MM/YYYY"
              value={endsAtStr}
              onChange={(e) => setEndsAtStr(maskDOB(e.target.value))}
            />
            {errors.endsAt ? <p className="text-xs text-destructive">{errors.endsAt}</p> : null}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tb-desc">Description</Label>
          <Textarea
            id="tb-desc"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tb-instructions">Instructions</Label>
          <Textarea
            id="tb-instructions"
            rows={3}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </div>
      </section>

      <section className="surface space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Questions</h2>
            <p className="text-xs text-muted-foreground">
              {questions.length} questions · {totalMarks} marks total
            </p>
          </div>
          <Button size="sm" onClick={addQuestion}>
            <Plus className="size-4" /> Add question
          </Button>
        </div>
        {errors.questions ? <p className="text-xs text-destructive">{errors.questions}</p> : null}

        <div className="space-y-4">
          {questions.map((q, i) => (
            <div key={q.id} className="rounded-xl border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <GripVertical className="size-4 text-muted-foreground" />
                  <Badge variant="secondary">Q{i + 1}</Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label="Move question up"
                  >
                    ↑
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => move(i, 1)}
                    disabled={i === questions.length - 1}
                    aria-label="Move question down"
                  >
                    ↓
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => removeQuestion(q.id)}
                    aria-label="Delete question"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_140px_100px]">
                <div className="space-y-1.5 sm:col-span-1">
                  <Label htmlFor={`q-text-${q.id}`}>Question text</Label>
                  <Textarea
                    id={`q-text-${q.id}`}
                    rows={2}
                    value={q.text}
                    onChange={(e) => updateQuestion(q.id, { text: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`q-type-${q.id}`}>Type</Label>
                  <Select value={q.type} onValueChange={(v) => changeType(q.id, v as QuestionType)}>
                    <SelectTrigger id={`q-type-${q.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mcq">Multiple choice</SelectItem>
                      <SelectItem value="truefalse">True / False</SelectItem>
                      <SelectItem value="short">Short answer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`q-marks-${q.id}`}>Marks</Label>
                  <Input
                    id={`q-marks-${q.id}`}
                    type="number"
                    min={1}
                    value={q.marks}
                    onChange={(e) => updateQuestion(q.id, { marks: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {q.type === "short" ? (
                  <div className="space-y-1.5">
                    <Label htmlFor={`q-answer-${q.id}`}>Model answer</Label>
                    <Input
                      id={`q-answer-${q.id}`}
                      value={typeof q.answer === "string" ? q.answer : ""}
                      onChange={(e) => updateQuestion(q.id, { answer: e.target.value })}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Options — select the correct answer</Label>
                    <RadioGroup
                      value={String(q.answer)}
                      onValueChange={(v) => updateQuestion(q.id, { answer: Number(v) })}
                      className="space-y-2"
                    >
                      {q.options.map((opt, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <RadioGroupItem value={String(oi)} id={`q-${q.id}-opt-${oi}`} />
                          <Input
                            aria-label={`Option ${oi + 1}`}
                            value={opt}
                            disabled={q.type === "truefalse"}
                            className={cn("flex-1", q.type === "truefalse" && "opacity-70")}
                            onChange={(e) => {
                              const next = [...q.options];
                              next[oi] = e.target.value;
                              updateQuestion(q.id, { options: next });
                            }}
                          />
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                )}
              </div>
              {questionErrors[q.id] ? (
                <p className="mt-2 text-xs text-destructive">{questionErrors[q.id]}</p>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" disabled={saving} onClick={() => save("draft")}>
          Save as draft
        </Button>
        <Button disabled={saving} onClick={() => save("published")}>
          {saving ? "Saving…" : "Publish"}
        </Button>
      </div>
    </div>
  );
}
