import { prisma } from "../src/config/prisma.js";

const rows = await prisma.$queryRaw<Array<Record<string, bigint>>>`
SELECT
  (SELECT COUNT(*) FROM students) AS students,
  (SELECT COUNT(*) FROM students WHERE status = 'ACTIVE') AS students_active,
  (SELECT COUNT(*) FROM students WHERE status = 'INACTIVE') AS students_inactive,
  (SELECT COUNT(*) FROM students WHERE status = 'BLOCKED') AS students_blocked,
  (SELECT COUNT(*) FROM conversations) AS conversations,
  (SELECT COUNT(*) FROM conversations WHERE mode = 'AI') AS conversations_ai,
  (SELECT COUNT(*) FROM conversations WHERE mode = 'HUMAN') AS conversations_human,
  (SELECT COUNT(*) FROM conversations WHERE mode = 'PAUSED') AS conversations_paused,
  (SELECT COUNT(*) FROM students s WHERE NOT EXISTS (SELECT 1 FROM conversations c WHERE c.student_id = s.id)) AS students_without_conversation,
  (SELECT COUNT(*) FROM conversations c WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.id = c.student_id)) AS conversations_without_student,
  (SELECT COUNT(*) FROM (SELECT kommo_lead_id FROM conversations WHERE kommo_lead_id IS NOT NULL GROUP BY kommo_lead_id HAVING COUNT(*) > 1) d) AS duplicated_kommo_lead_ids,
  (SELECT COUNT(*) FROM (SELECT whatsapp_id FROM students WHERE whatsapp_id IS NOT NULL GROUP BY whatsapp_id HAVING COUNT(*) > 1) d) AS duplicated_whatsapp_ids,
  (SELECT COUNT(*) FROM students WHERE phone !~ '^55[1-9][1-9][0-9]{8,9}$') AS invalid_phone_format,
  (SELECT COUNT(*) FROM conversation_events) AS conversation_events,
  (SELECT COUNT(*) FROM messages) AS messages,
  (SELECT COUNT(*) FROM answer_logs) AS answer_logs`;

console.log(
  JSON.stringify(
    rows[0],
    (_, value) => (typeof value === "bigint" ? Number(value) : value),
    2,
  ),
);
await prisma.$disconnect();
