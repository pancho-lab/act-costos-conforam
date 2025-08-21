-- CreateTable
CREATE TABLE "category_price_analysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category_id" INTEGER NOT NULL,
    "company_id" INTEGER NOT NULL,
    "has_products" BOOLEAN NOT NULL,
    "products_count" INTEGER NOT NULL,
    "uniform_price" DECIMAL,
    "price_consistency" TEXT NOT NULL,
    "message" TEXT,
    "suggested_action" TEXT,
    "analyzed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "category_price_analysis_category_id_company_id_key" ON "category_price_analysis"("category_id", "company_id");
