"use client";

import { useState } from "react";
import { ageOnDate } from "@/shared/personalInformation";
import Image from "next/image";

export type ParticipantInformation = { jerseyNumber?: string; allergies?: string; medicalConditions?: string; nationalIdNumber?: string; birthDate?: string; guardianPhone?: string; drugAllergies?: string; foodAllergies?: string; hospitalizationHistory?: string };

export function ParticipantInformationFields({ value = {}, onChange, required = false }: {
  value?: ParticipantInformation;
  onChange?: (key: keyof ParticipantInformation, value: string) => void;
  required?: boolean;
}) {
  const [birthDate, setBirthDate] = useState(value.birthDate ?? "");
  return <>
    <div className="field field--wide"><label htmlFor="nationalIdNumber">เลขประจำตัวประชาชน / National ID number {required && "*"}</label><input id="nationalIdNumber" name="nationalIdNumber" className="input" required={required} inputMode="numeric" pattern="[0-9]{13}" minLength={13} maxLength={13} {...(onChange ? {value: value.nationalIdNumber ?? "", onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange("nationalIdNumber", e.target.value)} : {defaultValue: value.nationalIdNumber})}/></div>
    <div className="field"><label htmlFor="birthDate">วัน/เดือน/ปีเกิด / Date of birth {required && "*"}</label><input id="birthDate" name="birthDate" type="date" className="input" required={required} max={new Date().toISOString().slice(0,10)} value={onChange ? value.birthDate ?? "" : birthDate} onChange={e => {setBirthDate(e.target.value); onChange?.("birthDate", e.target.value);}}/><small>ใช้ปี ค.ศ. / Gregorian year (e.g. 2007)</small></div>
    <div className="field"><label htmlFor="age">อายุ / Age</label><input id="age" className="input" readOnly value={ageOnDate(onChange ? value.birthDate ?? "" : birthDate) ?? ""}/><small>คำนวณจากวันเกิด / Calculated from date of birth</small></div>
    <div className="field field--wide"><label htmlFor="guardianPhone">เบอร์โทรศัพท์ผู้ปกครอง / Parent or guardian phone {required && "*"}</label><input id="guardianPhone" name="guardianPhone" className="input" type="tel" required={required} maxLength={25} {...(onChange ? {value: value.guardianPhone ?? "", onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange("guardianPhone", e.target.value)} : {defaultValue: value.guardianPhone})}/></div>
    <div className="field field--wide">
      <label htmlFor="jerseyNumber">เลขเสื้อ / Jersey number {required && <span> * Required / จำเป็น</span>}</label>
      <Image src="/jersey-no.png" width={1112} height={826} alt="Example: jersey number 92 highlighted in red on the back of the shirt" sizes="(max-width: 600px) 100vw, 440px" style={{ width: "100%", maxWidth: 440, height: "auto", borderRadius: 12, marginBottom: 12 }}/>
      <input className="input" id="jerseyNumber" name="jerseyNumber" required={required} maxLength={10} inputMode="numeric" pattern="[0-9]{1,10}" placeholder="92" aria-describedby="jersey-help" {...(onChange ? { value: value.jerseyNumber ?? "", onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChange("jerseyNumber", event.target.value) } : { defaultValue: value.jerseyNumber })}/>
      <small id="jersey-help">กรอกหมายเลขบนเสื้อที่คุณจะใส่จริงในวันงาน เลข 92 ในภาพเป็นเพียงตัวอย่าง กรุณากรอกเลขเสื้อของคุณเอง / Enter the number printed on the jersey you will actually wear on the event day. The number 92 above is only an example; enter your own jersey number.</small>
    </div>
    {([["drugAllergies", "ประวัติการแพ้ยา / Drug allergies", "List medications and reactions"], ["foodAllergies", "Food allergies / ประวัติการแพ้อาหาร", "List foods and reactions"], ["hospitalizationHistory", "Hospitalization / surgery history / ประวัติการเข้ารับการรักษาในโรงพยาบาล / การผ่าตัด", "Describe previous hospital admissions or operations"], ["medicalConditions", "โรคประจำตัว / Medical conditions", "โรคประจำตัวหรือข้อมูลสุขภาพที่เจ้าหน้าที่ควรทราบ / Personal illnesses or health information staff should know"]] as const).map(([key, label, hint]) => <div className="field field--wide" key={key}>
      <label htmlFor={key}>{label} {required && "*"}</label>
      <textarea className="input" id={key} name={key} rows={3} maxLength={2000} required={required} placeholder={hint} aria-describedby={`${key}-help`} {...(onChange ? { value: value[key] ?? "", onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => onChange(key, event.target.value) } : { defaultValue: value[key] })}/>
      <small id={`${key}-help`}>หากไม่มีให้กรอก “ไม่มี” / Enter “None” if you have none.</small>
    </div>)}
  </>;
}
