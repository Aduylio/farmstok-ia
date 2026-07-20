/*
  Warnings:

  - You are about to drop the `AnswerLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AnswerSource` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Consultant` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Conversation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ConversationEvent` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `KnowledgeChunk` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `KnowledgeSource` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Message` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Student` table. If the table is not empty, all the data it contains will be lost.

*/
-- Destructive recreation is acceptable only for the confirmed-empty local database.
-- Do not apply this migration to an environment containing relevant data.

-- CreateEnum
CREATE TYPE "student_status" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "conversation_mode" AS ENUM ('AI', 'HUMAN', 'PAUSED');

-- CreateEnum
CREATE TYPE "message_sender" AS ENUM ('STUDENT', 'AI', 'CONSULTANT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "message_direction" AS ENUM ('INCOMING', 'OUTGOING');

-- CreateEnum
CREATE TYPE "message_type" AS ENUM ('TEXT', 'IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT', 'LOCATION', 'INTERACTIVE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "knowledge_source_type" AS ENUM ('AULA', 'LIVE', 'MENTORIA', 'PDF', 'FAQ', 'OUTRO');

-- CreateEnum
CREATE TYPE "conversation_event_type" AS ENUM ('PAUSED', 'RESUMED', 'HUMAN_ASSUMED', 'AI_ASSUMED', 'CONSULTANT_CHANGED');

-- CreateEnum
CREATE TYPE "change_actor" AS ENUM ('SYSTEM', 'AI', 'CONSULTANT', 'STUDENT');

-- DropForeignKey
ALTER TABLE "AnswerLog" DROP CONSTRAINT "AnswerLog_conversationId_fkey";

-- DropForeignKey
ALTER TABLE "AnswerLog" DROP CONSTRAINT "AnswerLog_studentId_fkey";

-- DropForeignKey
ALTER TABLE "AnswerSource" DROP CONSTRAINT "AnswerSource_answerLogId_fkey";

-- DropForeignKey
ALTER TABLE "AnswerSource" DROP CONSTRAINT "AnswerSource_knowledgeChunkId_fkey";

-- DropForeignKey
ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_consultantId_fkey";

-- DropForeignKey
ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_studentId_fkey";

-- DropForeignKey
ALTER TABLE "ConversationEvent" DROP CONSTRAINT "ConversationEvent_conversationId_fkey";

-- DropForeignKey
ALTER TABLE "KnowledgeChunk" DROP CONSTRAINT "KnowledgeChunk_sourceId_fkey";

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_conversationId_fkey";

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_studentId_fkey";

-- DropTable
DROP TABLE "AnswerLog";

-- DropTable
DROP TABLE "AnswerSource";

-- DropTable
DROP TABLE "Consultant";

-- DropTable
DROP TABLE "Conversation";

-- DropTable
DROP TABLE "ConversationEvent";

-- DropTable
DROP TABLE "KnowledgeChunk";

-- DropTable
DROP TABLE "KnowledgeSource";

-- DropTable
DROP TABLE "Message";

-- DropTable
DROP TABLE "Student";

-- DropEnum
DROP TYPE "ConversationEventType";

-- DropEnum
DROP TYPE "ConversationMode";

-- DropEnum
DROP TYPE "KnowledgeSourceType";

-- DropEnum
DROP TYPE "MessageDirection";

-- DropEnum
DROP TYPE "MessageSender";

-- CreateTable
CREATE TABLE "students" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "whatsapp_id" TEXT,
    "status" "student_status" NOT NULL DEFAULT 'ACTIVE',
    "course_access" JSONB,
    "access_granted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "access_expires_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "consultants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_id" UUID NOT NULL,
    "consultant_id" UUID,
    "mode" "conversation_mode" NOT NULL DEFAULT 'AI',
    "kommo_lead_id" TEXT,
    "last_message_at" TIMESTAMPTZ(3),
    "mode_changed_at" TIMESTAMPTZ(3),
    "mode_changed_by" "change_actor",
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID NOT NULL,
    "direction" "message_direction" NOT NULL,
    "sender" "message_sender" NOT NULL,
    "whatsapp_message_id" TEXT,
    "content" TEXT NOT NULL,
    "message_type" "message_type" NOT NULL DEFAULT 'TEXT',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID NOT NULL,
    "type" "conversation_event_type" NOT NULL,
    "changed_by" "change_actor",
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_sources" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" "knowledge_source_type" NOT NULL,
    "title" TEXT NOT NULL,
    "course" TEXT NOT NULL,
    "module" TEXT,
    "lesson_number" INTEGER,
    "source_url" TEXT,
    "recorded_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "storage_path" TEXT,
    "instructor" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "knowledge_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_chunks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "start_time" TEXT,
    "end_time" TEXT,
    "token_count" INTEGER,
    "metadata" JSONB,
    "content_hash" TEXT NOT NULL,
    "embedding" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "answer_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "needs_human" BOOLEAN NOT NULL DEFAULT false,
    "model" TEXT,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "answer_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "answer_sources" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "answer_log_id" UUID NOT NULL,
    "knowledge_chunk_id" UUID NOT NULL,
    "similarity" DOUBLE PRECISION NOT NULL,
    "ranking" INTEGER NOT NULL,

    CONSTRAINT "answer_sources_pkey" PRIMARY KEY ("id")
);

-- AddCheckConstraint
ALTER TABLE "students" ADD CONSTRAINT "students_access_period_check"
CHECK ("access_expires_at" IS NULL OR "access_expires_at" > "access_granted_at");

ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_lesson_number_check"
CHECK ("lesson_number" IS NULL OR "lesson_number" > 0);

ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_version_check"
CHECK ("version" > 0);

ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_token_count_check"
CHECK ("token_count" IS NULL OR "token_count" >= 0);

ALTER TABLE "answer_logs" ADD CONSTRAINT "answer_logs_confidence_check"
CHECK ("confidence" BETWEEN 0 AND 1);

ALTER TABLE "answer_logs" ADD CONSTRAINT "answer_logs_input_tokens_check"
CHECK ("input_tokens" IS NULL OR "input_tokens" >= 0);

ALTER TABLE "answer_logs" ADD CONSTRAINT "answer_logs_output_tokens_check"
CHECK ("output_tokens" IS NULL OR "output_tokens" >= 0);

ALTER TABLE "answer_sources" ADD CONSTRAINT "answer_sources_similarity_check"
CHECK ("similarity" BETWEEN 0 AND 1);

ALTER TABLE "answer_sources" ADD CONSTRAINT "answer_sources_ranking_check"
CHECK ("ranking" > 0);

-- CreateIndex
CREATE UNIQUE INDEX "students_phone_key" ON "students"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "students_whatsapp_id_key" ON "students"("whatsapp_id");

-- CreateIndex
CREATE UNIQUE INDEX "consultants_phone_key" ON "consultants"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "consultants_email_key" ON "consultants"("email");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_kommo_lead_id_key" ON "conversations"("kommo_lead_id");

-- CreateIndex
CREATE INDEX "conversations_student_id_idx" ON "conversations"("student_id");

-- CreateIndex
CREATE INDEX "conversations_last_message_at_idx" ON "conversations"("last_message_at");

-- CreateIndex
CREATE UNIQUE INDEX "messages_whatsapp_message_id_key" ON "messages"("whatsapp_message_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "conversation_events_conversation_id_created_at_idx" ON "conversation_events"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "knowledge_sources_is_active_idx" ON "knowledge_sources"("is_active");

-- CreateIndex
CREATE INDEX "knowledge_sources_course_idx" ON "knowledge_sources"("course");

-- CreateIndex
CREATE INDEX "knowledge_chunks_source_id_idx" ON "knowledge_chunks"("source_id");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_chunks_source_id_content_hash_key" ON "knowledge_chunks"("source_id", "content_hash");

-- CreateIndex
CREATE INDEX "answer_logs_conversation_id_created_at_idx" ON "answer_logs"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "answer_sources_answer_log_id_idx" ON "answer_sources"("answer_log_id");

-- CreateIndex
CREATE INDEX "answer_sources_knowledge_chunk_id_idx" ON "answer_sources"("knowledge_chunk_id");

-- CreateIndex
CREATE UNIQUE INDEX "answer_sources_answer_log_id_knowledge_chunk_id_key" ON "answer_sources"("answer_log_id", "knowledge_chunk_id");

-- CreateIndex
CREATE UNIQUE INDEX "answer_sources_answer_log_id_ranking_key" ON "answer_sources"("answer_log_id", "ranking");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_consultant_id_fkey" FOREIGN KEY ("consultant_id") REFERENCES "consultants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_events" ADD CONSTRAINT "conversation_events_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "knowledge_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answer_logs" ADD CONSTRAINT "answer_logs_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answer_sources" ADD CONSTRAINT "answer_sources_answer_log_id_fkey" FOREIGN KEY ("answer_log_id") REFERENCES "answer_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answer_sources" ADD CONSTRAINT "answer_sources_knowledge_chunk_id_fkey" FOREIGN KEY ("knowledge_chunk_id") REFERENCES "knowledge_chunks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
