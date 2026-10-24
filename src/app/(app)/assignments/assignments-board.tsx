"use client";

import { ListPlus, Pencil, Trash2, UserMinus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { AnimatedBadge } from "@/components/motion/animated-badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleIndicator,
  CollapsibleTrigger,
} from "@/components/motion/collapsible";
import { Button } from "@/components/ui/button";
import type { EvidencePolicy, TaskKind } from "@/modules/framework";
import {
  type ItemInput,
  type ItemLimits,
  type ItemOptions,
  ItemSheet,
  sheetItemOf,
} from "../_items/item-sheet.tsx";
import {
  addTemplateItemAction,
  deleteTemplateAction,
  removeTemplateItemAction,
  revokeAssignmentAction,
  updateTemplateItemAction,
} from "./actions.ts";
import { AssignButton, type Person, type Week } from "./assign-sheet.tsx";
import { ConfirmButton } from "./confirm-button.tsx";
import { TemplateButton } from "./template-sheet.tsx";

type TemplateItem = {
  id: string;
  title: string;
  kind: TaskKind;
  evidence: EvidencePolicy;
  words: { kind: string; evidence: string };
};

// A template as the page shows it: shared by every department or the department's own, the axis
// its tasks go under, the role it grants, whether a term has it assigned, its items, and the people
// it is given to in the term on view, each with the weeks, the week their tasks are due in, and
// whether this assignment gave them the role, which its revocation then takes back.
export type Template = {
  id: string;
  title: string;
  shared: boolean;
  axisId: string;
  axis: string;
  grants?: string;
  assigned: boolean;
  items: TemplateItem[];
  holders: {
    id: string;
    userId: string;
    name: string;
    employeeNumber: string;
    range: string;
    due: string;
    granted: boolean;
  }[];
};

type Props = {
  termId: string;
  departmentId: string;
  /** The term's weeks, each with its days. */
  weeks: Week[];
  /** The week reached today, which a range starts on. */
  thisWeek: number;
  /** The term is not closed: its assignments change. */
  editable: boolean;
  templates: Template[];
  people: Person[];
  axes: { value: string; label: string }[];
  itemOptions: ItemOptions;
  limits: ItemLimits;
};

// The department's assignments for the term (Step 21): each template it assigns, shared ones first,
// with whom it is given to and its items; the department's own templates and their items are kept
// here too.
export function AssignmentsBoard(props: Props) {
  const t = useTranslations("assignments");
  const { templates, departmentId, axes, limits } = props;
  // A new template's tasks go where the shared ones' go, axis 9 as seeded.
  const axis =
    templates.find(({ shared }) => shared)?.axisId ?? axes[0]?.value ?? "";
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {props.editable ? null : (
          <p className="text-muted-foreground text-sm">{t("closed")}</p>
        )}
        <div className="ms-auto">
          <TemplateButton
            departmentId={departmentId}
            axes={axes}
            axis={axis}
            titleLength={limits.title}
          />
        </div>
      </div>
      <ul className="flex flex-col gap-4">
        {templates.map((template) => (
          <li key={template.id}>
            <TemplateCard {...props} template={template} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function TemplateCard({
  template,
  termId,
  departmentId,
  weeks,
  thisWeek,
  editable,
  people,
  axes,
  itemOptions,
  limits,
}: Props & { template: Template }) {
  const t = useTranslations("assignments");
  const refusals = useTranslations("actions");
  const heading = useId();
  const held = new Set(template.holders.map(({ userId }) => userId));
  const own = !template.shared;

  const revoke = async (assignmentId: string) => {
    const result = await revokeAssignmentAction({ assignmentId });
    const status = result?.data?.status;
    if (status === "revoked") return undefined;
    return status
      ? t(`revoke.refusals.${status}`)
      : refusals(result?.serverError ?? "unexpected");
  };
  const removeTemplate = async () => {
    const result = await deleteTemplateAction({ templateId: template.id });
    const status = result?.data?.status;
    if (status === "deleted") return undefined;
    return status
      ? t(`template.refusals.${status}`)
      : refusals(result?.serverError ?? "unexpected");
  };

  return (
    <section
      aria-labelledby={heading}
      className="rounded-xl border bg-card shadow-xs"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={heading} className="text-lg">
              {template.title}
            </h2>
            <AnimatedBadge status={own ? "pending" : "neutral"}>
              {own ? t("own") : t("shared")}
            </AnimatedBadge>
          </div>
          <p className="mt-1 text-muted-foreground text-sm">
            {template.axis} · {t("items", { count: template.items.length })}
          </p>
          {template.grants ? (
            <p className="mt-0.5 text-sm">
              {t("grants", { role: template.grants })}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {editable ? (
            <AssignButton
              termId={termId}
              departmentId={departmentId}
              template={template}
              people={people.filter(({ userId }) => !held.has(userId))}
              staffed={people.length > 0}
              weeks={weeks}
              thisWeek={thisWeek}
            />
          ) : null}
          {own ? (
            <TemplateButton
              departmentId={departmentId}
              template={template}
              axes={axes}
              axis={template.axisId}
              titleLength={limits.title}
            />
          ) : null}
          {own && !template.assigned ? (
            <ConfirmButton
              label={t("template.delete")}
              name={t("template.deleteLabel", { title: template.title })}
              icon={<Trash2 aria-hidden />}
              title={t("template.deleteTitle", { title: template.title })}
              description={t("template.deleteDescription")}
              confirm={t("template.delete")}
              running={t("template.deleting")}
              done={t("template.deleted", { title: template.title })}
              run={removeTemplate}
            />
          ) : null}
        </div>
      </div>

      <div className="border-t px-5 py-4">
        <h3 className="font-medium text-sm">{t("holders")}</h3>
        {template.holders.length === 0 ? (
          <p className="mt-1 text-muted-foreground text-sm">{t("noHolders")}</p>
        ) : (
          <ul className="mt-1 flex flex-col divide-y">
            {template.holders.map((holder) => (
              <li
                key={holder.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{holder.name}</span>{" "}
                    <span dir="ltr" className="text-muted-foreground text-xs">
                      {holder.employeeNumber}
                    </span>
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {holder.range} · {holder.due}
                  </p>
                </div>
                {editable ? (
                  <ConfirmButton
                    label={t("revoke.button")}
                    name={t("revoke.label", {
                      name: holder.name,
                      title: template.title,
                    })}
                    icon={<UserMinus aria-hidden />}
                    title={t("revoke.title", {
                      name: holder.name,
                      title: template.title,
                    })}
                    description={[
                      t("revoke.description"),
                      ...(template.grants && holder.granted
                        ? [t("revoke.grants", { role: template.grants })]
                        : []),
                    ].join(" ")}
                    confirm={t("revoke.button")}
                    running={t("revoke.running")}
                    done={t("revoke.done", { name: holder.name })}
                    run={() => revoke(holder.id)}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Collapsible className="border-t">
        <CollapsibleTrigger className="rounded-b-xl px-5">
          {t("tasks")}
          <CollapsibleIndicator />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <TemplateItems
            template={template}
            own={own}
            options={itemOptions}
            limits={limits}
          />
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}

// A template's items in order, each in words. The department's own are added, corrected and
// taken out here, and their tasks follow at the next pass.
function TemplateItems({
  template,
  own,
  options,
  limits,
}: {
  template: Template;
  own: boolean;
  options: ItemOptions;
  limits: ItemLimits;
}) {
  const t = useTranslations("assignments");
  const refusals = useTranslations("actions");
  const [editing, setEditing] = useState<"new" | TemplateItem>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [resetKey, setResetKey] = useState(0);
  const [, startTransition] = useTransition();

  const open = (item: "new" | TemplateItem) => {
    setError(undefined);
    setEditing(item);
  };
  const save = (input: ItemInput, another: boolean) =>
    startTransition(async () => {
      const item = {
        title: input.title,
        kind: input.kind,
        evidence: input.evidence,
      };
      setSaving(true);
      setError(undefined);
      const result =
        editing === "new"
          ? await addTemplateItemAction({ templateId: template.id, ...item })
          : await updateTemplateItemAction({
              itemId: editing?.id ?? "",
              ...item,
            });
      setSaving(false);
      const status = result?.data?.status;
      if (status === "saved" || status === "unchanged") {
        // While the sheet stays open for the next item, the toast shows at the top, clear of its
        // actions at the screen's foot (UX review 2).
        if (status === "saved") {
          toast.success(t("item.saved"), {
            position: another ? "top-center" : undefined,
          });
        }
        if (another) setResetKey((key) => key + 1);
        else setEditing(undefined);
        return;
      }
      setError(
        status
          ? t(`item.refusals.${status}`)
          : refusals(result?.serverError ?? "unexpected"),
      );
    });
  const remove = async (itemId: string) => {
    const result = await removeTemplateItemAction({ itemId });
    const status = result?.data?.status;
    if (status === "removed") return undefined;
    return status
      ? t(`item.refusals.${status}`)
      : refusals(result?.serverError ?? "unexpected");
  };

  return (
    <div className="flex flex-col gap-3 px-5 pb-4">
      {template.items.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("noItems")}</p>
      ) : (
        <ol className="flex flex-col divide-y">
          {template.items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm">{item.title}</p>
                <p className="text-muted-foreground text-sm">
                  {item.words.kind} · {item.words.evidence}
                </p>
              </div>
              {own ? (
                <div className="flex flex-wrap items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("item.edit", { title: item.title })}
                    onClick={() => open(item)}
                  >
                    <Pencil aria-hidden />
                  </Button>
                  <ConfirmButton
                    name={t("item.remove", { title: item.title })}
                    icon={<Trash2 aria-hidden />}
                    title={t("item.removeTitle", { title: item.title })}
                    description={t("item.removeDescription")}
                    confirm={t("item.removeConfirm")}
                    running={t("item.removing")}
                    done={t("item.removed")}
                    run={() => remove(item.id)}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      )}
      {own ? (
        <div>
          <Button type="button" variant="outline" onClick={() => open("new")}>
            <ListPlus aria-hidden />
            {t("item.add")}
          </Button>
        </div>
      ) : null}
      {editing ? (
        <ItemSheet
          title={
            editing === "new"
              ? t("item.addTitle", { title: template.title })
              : t("item.editTitle", { title: template.title })
          }
          description={t("item.description")}
          item={editing === "new" ? undefined : sheetItemOf(editing)}
          assignment
          options={options}
          limits={limits}
          saving={saving}
          error={error}
          onSave={(input) => save(input, false)}
          onSaveAndAdd={
            editing === "new" ? (input) => save(input, true) : undefined
          }
          resetKey={resetKey}
          onClose={() => setEditing(undefined)}
        />
      ) : null}
    </div>
  );
}
