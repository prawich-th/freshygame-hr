import type { Doc } from "@/convex/_generated/dataModel";
import { type CorrectionField } from "@/shared/corrections";

type RecordField = { label: string; value?: string | number; correction?: CorrectionField };

export function ParticipantRecordDetails({ participant: p, role, activityLabel, category }: {
  participant: Doc<"participants">;
  role: string;
  activityLabel: string;
  category: string;
}) {
  const groups: { title: string; description: string; fields: RecordField[]; wide?: boolean }[] = [
    {
      title: "Personal information", description: "Names and identity details",
      fields: [
        { label: "Thai full name", value: p.fullNameThai, correction: "fullNameThai" },
        { label: "English full name", value: p.fullNameEnglish, correction: "fullNameEnglish" },
        { label: "Thai nickname", value: p.nicknameThai, correction: "nicknameThai" },
        { label: "English nickname", value: p.nicknameEnglish, correction: "nicknameEnglish" },
        { label: "Sex", value: p.sex, correction: "sex" },
        { label: "Date of birth", value: p.birthDate, correction: "birthDate" },
        { label: "Age", value: p.age },
        { label: "National ID number", value: p.nationalIdNumber, correction: "nationalIdNumber" },
      ],
    },
    {
      title: "Registration", description: "Student details and participation",
      fields: [
        { label: "Student ID", value: p.studentId },
        { label: "Faculty", value: p.faculty, correction: "faculty" },
        { label: "Role", value: role },
        { label: activityLabel, value: p.sport },
        { label: "Category / type", value: category },
        ...(p.participantKind === "performer" ? [] : [{ label: "Event-day jersey number", value: p.jerseyNumber, correction: "jerseyNumber" as const }]),
      ],
    },
    {
      title: "Contact details", description: "How to reach the participant",
      fields: [
        { label: "Registered phone", value: p.phone },
        { label: "Email", value: p.email, correction: "email" },
        { label: "Preferred contact", value: p.preferredContact, correction: "preferredContact" },
        { label: "LINE ID", value: p.lineId, correction: "lineId" },
        { label: "Instagram", value: p.instagram ? `@${p.instagram}` : undefined, correction: "instagram" },
      ],
    },
    {
      title: "Emergency contact", description: "Who to contact in an emergency",
      fields: [
        { label: "Contact name", value: p.emergencyContactName, correction: "emergencyContactName" },
        { label: "Relationship", value: p.emergencyContactRelationship, correction: "emergencyContactRelationship" },
        { label: "Contact phone", value: p.guardianPhone, correction: "guardianPhone" },
      ],
    },
    {
      title: "Health information", description: "Allergies, conditions, and medical history", wide: true,
      fields: [
        { label: "Drug allergies", value: p.drugAllergies, correction: "drugAllergies" },
        { label: "Food allergies", value: p.foodAllergies, correction: "foodAllergies" },
        { label: "Other allergy information", value: p.allergies },
        { label: "Medical conditions", value: p.medicalConditions, correction: "medicalConditions" },
        { label: "Hospitalization / surgery history", value: p.hospitalizationHistory, correction: "hospitalizationHistory" },
      ],
    },
  ];

  return <div className="record-sections">
    {groups.map(group => <section key={group.title} className={`record-section ${group.wide ? "record-section--wide" : ""}`}>
      <header><h3>{group.title}</h3><p>{group.description}</p></header>
      <dl className="record-fields">
        {group.fields.map(field => {
          const request = p.correctionRequests?.find(request => request.field === field.correction);
          return <div className={request ? "record-field record-field--marked" : "record-field"} key={field.label}>
            <dt>{field.label}</dt>
            <dd>{field.value === undefined || field.value === "" ? <span className="record-field__empty">Not provided</span> : field.value}</dd>
            {request && <dd className="record-field__correction">{request.status === "requested" ? "Correction requested" : "Resubmitted · Review needed"}{request.note && <span>{request.note}</span>}</dd>}
          </div>;
        })}
      </dl>
    </section>)}
  </div>;
}
