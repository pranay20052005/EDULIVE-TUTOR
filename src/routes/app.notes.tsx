import { Link, createFileRoute } from "@tanstack/react-router";
import { Download, FileQuestion, FileText, Lock, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { CardSkeleton, EmptyState, PageHeader } from "@/components/ui-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { relative, toDDMMYYYY } from "@/lib/format";
import { useStudentEnrollments } from "@/lib/db/hooks";
import { materialService, questionPaperService } from "@/lib/db";
import { useSession } from "@/lib/session";
import type { Material, QuestionPaper } from "@/lib/db/types";

export const Route = createFileRoute("/app/notes")({
  head: () => ({
    meta: [
      { title: "Notes & study material — EduLive" },
      {
        name: "description",
        content: "Chapter-wise PDF notes, worksheets and question papers for your subjects.",
      },
      { property: "og:title", content: "Notes & study material — EduLive" },
      {
        property: "og:description",
        content: "Download chapter notes and previous question papers.",
      },
    ],
  }),
  component: NotesPage,
});

function NotesPage() {
  const { student } = useSession();
  const { data: enrollments = [], isLoading: enrollmentsLoading } = useStudentEnrollments(
    student?.id,
  );
  const enrolledSubjectIds = useMemo(
    () => (enrollments || []).map((e: any) => e.subject_id).filter(Boolean),
    [enrollments],
  );

  const { data: allMaterials = [], isLoading: materialsLoading } = useQuery({
    queryKey: ["materials-by-subjects", enrolledSubjectIds],
    queryFn: async () => {
      if (!enrolledSubjectIds.length) return [];
      const results = await Promise.all(
        enrolledSubjectIds.map((id: string) => materialService.listBySubject(id)),
      );
      return results.flat();
    },
    enabled: enrolledSubjectIds.length > 0,
  });

  const { data: allPapers = [], isLoading: papersLoading } = useQuery({
    queryKey: ["question-papers-by-subjects", enrolledSubjectIds],
    queryFn: async () => {
      if (!enrolledSubjectIds.length) return [];
      const results = await Promise.all(
        enrolledSubjectIds.map((id: string) => questionPaperService.listBySubject(id)),
      );
      return results.flat();
    },
    enabled: enrolledSubjectIds.length > 0,
  });

  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [chapterFilter, setChapterFilter] = useState("all");

  const chapters = useMemo(() => {
    const names = new Set<string>();
    allMaterials.forEach((m: any) => {
      const title = m.chapter?.title || (typeof m.chapter === "string" ? m.chapter : null);
      if (title) names.add(title);
    });
    return Array.from(names).sort();
  }, [allMaterials]);

  const filteredNotes = useMemo(() => {
    return allMaterials.filter((n: any) => {
      const chapterTitle = n.chapter?.title || (typeof n.chapter === "string" ? n.chapter : "");
      if (subjectFilter !== "all" && n.subject_id !== subjectFilter) return false;
      if (chapterFilter !== "all" && chapterTitle !== chapterFilter) return false;
      if (search.trim()) {
        const query = search.trim().toLowerCase();
        const hay = `${n.title || ""} ${chapterTitle} ${n.description || ""}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }, [allMaterials, subjectFilter, chapterFilter, search]);

  const filteredPapers = useMemo(() => {
    return allPapers.filter((p: any) => {
      if (subjectFilter !== "all" && p.subject_id !== subjectFilter) return false;
      if (search.trim()) {
        const query = search.trim().toLowerCase();
        const hay = `${p.title || ""} ${p.exam_type || ""} ${p.description || ""}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }, [allPapers, subjectFilter, search]);

  if (
    enrollmentsLoading ||
    (enrolledSubjectIds.length > 0 && (materialsLoading || papersLoading))
  ) {
    return (
      <div className="space-y-6">
        <PageHeader title="Notes & study material" subtitle="Loading your material…" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  if (!enrollmentsLoading && enrolledSubjectIds.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Notes & study material"
          subtitle="Chapter notes and question papers for your subjects"
        />
        <EmptyState
          icon={Lock}
          title="You're not enrolled in any subject yet"
          body="Enroll in a course to unlock its notes, worksheets and question papers."
          action={
            <Button asChild>
              <Link to="/app/courses">Browse courses</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notes & study material"
        subtitle={`${allMaterials.length} notes · ${allPapers.length} question papers across your subjects`}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or chapter…"
            className="pl-9"
            aria-label="Search notes and question papers"
          />
        </div>
        <Select value={subjectFilter} onValueChange={setSubjectFilter}>
          <SelectTrigger className="w-full sm:w-48" aria-label="Filter by subject">
            <SelectValue placeholder="Subject" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All subjects</SelectItem>
            {enrollments.map((enrollment: any) => (
              <SelectItem key={enrollment.id} value={enrollment.subject_id}>
                {enrollment.subject?.name || "Subject"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={chapterFilter} onValueChange={setChapterFilter}>
          <SelectTrigger className="w-full sm:w-48" aria-label="Filter by chapter">
            <SelectValue placeholder="Chapter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All chapters</SelectItem>
            {chapters.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="notes">
        <TabsList>
          <TabsTrigger value="notes">Notes ({filteredNotes.length})</TabsTrigger>
          <TabsTrigger value="papers">Question papers ({filteredPapers.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="notes" className="mt-4">
          {filteredNotes.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No notes found"
              body="Try changing your filters or search term."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredNotes.map((n: any) => (
                <NoteCard key={n.id} note={n} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="papers" className="mt-4">
          {filteredPapers.length === 0 ? (
            <EmptyState
              icon={FileQuestion}
              title="No question papers found"
              body="Try changing your filters or search term."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredPapers.map((p: any) => (
                <PaperCard key={p.id} paper={p} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NoteCard({ note }: { note: Material }) {
  const chapterName = note.chapter?.title || (typeof note.chapter === "string" ? note.chapter : "");
  const hasFile = !!note.file_url && note.file_url !== "#";

  return (
    <article className="surface p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-accent/15 text-accent-foreground">
          <FileText className="size-5" />
        </span>
        <Badge variant="outline">{note.file_type || "PDF"}</Badge>
      </div>
      <p className="mt-4 truncate text-sm font-semibold">{note.title}</p>
      <p className="truncate text-xs text-muted-foreground">
        {note.subject?.name || "Subject"} {chapterName ? `· ${chapterName}` : ""}
      </p>
      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{note.description}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {note.file_size_kb ? `${(note.file_size_kb / 1024).toFixed(1)} MB` : "0.5 MB"} ·{" "}
        {relative(note.created_at)}
      </p>
      {hasFile ? (
        <Button asChild size="sm" className="mt-4 w-full gap-2">
          <a href={note.file_url} target="_blank" rel="noreferrer" download>
            <Download className="size-4" /> Download Note
          </a>
        </Button>
      ) : (
        <Button size="sm" variant="outline" className="mt-4 w-full" disabled>
          No file attached
        </Button>
      )}
    </article>
  );
}

function PaperCard({ paper }: { paper: QuestionPaper }) {
  const hasFile = !!paper.file_url && paper.file_url !== "#";

  return (
    <article className="surface p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
          <FileQuestion className="size-5" />
        </span>
        <Badge variant="outline">{paper.exam_type || "Exam"}</Badge>
      </div>
      <p className="mt-4 truncate text-sm font-semibold">{paper.title}</p>
      <p className="truncate text-xs text-muted-foreground">
        {paper.subject?.name || "Subject"} · {paper.standard || "10th"} Standard
      </p>
      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{paper.description}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {paper.total_marks || 100} marks · {paper.duration_min || 60} min
        {paper.available_from ? ` · valid ${toDDMMYYYY(paper.available_from)}` : ""}
      </p>
      {hasFile ? (
        <Button asChild size="sm" className="mt-4 w-full gap-2">
          <a href={paper.file_url} target="_blank" rel="noreferrer" download>
            <Download className="size-4" /> Download Paper
          </a>
        </Button>
      ) : (
        <Button size="sm" variant="outline" className="mt-4 w-full" disabled>
          No file attached
        </Button>
      )}
    </article>
  );
}
