import { studentNameSchema } from "./students.schemas.js";

export interface DemoStudentOptions {
  name: string;
  phone: string;
  whatsappId?: string;
  kommoLeadId?: string;
  course?: string;
  activeUntil?: string;
  execute: boolean;
  yes: boolean;
}

export function parseDemoStudentArgs(args: string[]): DemoStudentOptions {
  const values: Record<string, string> = {};
  let execute = false;
  let yes = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--execute") execute = true;
    else if (arg === "--yes") yes = true;
    else if (
      [
        "--name",
        "--phone",
        "--whatsapp-id",
        "--kommo-lead-id",
        "--course",
        "--active-until",
      ].includes(arg ?? "")
    ) {
      const value = args[++index];
      if (!value) throw new Error("INVALID_ARGUMENTS");
      values[arg!.slice(2)] = value;
    } else throw new Error("INVALID_ARGUMENTS");
  }
  if (execute && !yes) throw new Error("CONFIRMATION_REQUIRED");
  const name = studentNameSchema.parse(values.name);
  const phone = values.phone;
  if (phone === undefined) throw new Error("INVALID_ARGUMENTS");
  return {
    name,
    phone,
    ...(values["whatsapp-id"] === undefined
      ? {}
      : { whatsappId: values["whatsapp-id"] }),
    ...(values["kommo-lead-id"] === undefined
      ? {}
      : { kommoLeadId: values["kommo-lead-id"] }),
    ...(values.course === undefined ? {} : { course: values.course }),
    ...(values["active-until"] === undefined
      ? {}
      : { activeUntil: values["active-until"] }),
    execute,
    yes,
  };
}
