-- CreateTable
CREATE TABLE "draft_changes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" INTEGER NOT NULL,
    "field_name" TEXT NOT NULL,
    "current_value" DECIMAL,
    "new_value" DECIMAL NOT NULL,
    "entity_name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "draft_changes_session_id_idx" ON "draft_changes"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "draft_changes_session_id_entity_type_entity_id_field_name_key" ON "draft_changes"("session_id", "entity_type", "entity_id", "field_name");
