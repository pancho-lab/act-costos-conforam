import { PrismaClient } from '@prisma/client'
import { Decimal } from 'decimal.js'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting seed...')

  // Create admin user example (this would be created automatically by NextAuth on first login)
  console.log('✅ Users will be created automatically on first Google login')

  // Create some example category cost rules
  const exampleCategories = [
    { categoryId: 1, cost: new Decimal('100.00'), companyId: 1 },
    { categoryId: 2, cost: new Decimal('150.00'), companyId: 1 },
    { categoryId: 3, cost: new Decimal('200.00'), companyId: 1 },
  ]

  for (const category of exampleCategories) {
    await prisma.categoryCostRule.upsert({
      where: {
        categoryId_companyId: {
          categoryId: category.categoryId,
          companyId: category.companyId
        }
      },
      update: {
        cost: category.cost,
        updatedBy: 'seed'
      },
      create: {
        categoryId: category.categoryId,
        cost: category.cost,
        companyId: category.companyId,
        updatedBy: 'seed'
      }
    })
  }

  console.log(`✅ Created ${exampleCategories.length} category cost rules`)

  // Create some example product overrides
  const exampleOverrides = [
    { productTmplId: 1, cost: new Decimal('120.00'), companyId: 1 },
    { productTmplId: 2, cost: new Decimal('180.00'), companyId: 1 },
  ]

  for (const override of exampleOverrides) {
    await prisma.productCostOverride.upsert({
      where: {
        productTmplId_companyId: {
          productTmplId: override.productTmplId,
          companyId: override.companyId
        }
      },
      update: {
        cost: override.cost,
        updatedBy: 'seed'
      },
      create: {
        productTmplId: override.productTmplId,
        cost: override.cost,
        companyId: override.companyId,
        updatedBy: 'seed'
      }
    })
  }

  console.log(`✅ Created ${exampleOverrides.length} product cost overrides`)

  // Create an audit log entry
  await prisma.auditLog.create({
    data: {
      actor: 'system',
      action: 'SEED',
      entity: 'Database',
      entityId: 'initial',
      after: {
        categoryRules: exampleCategories.length,
        productOverrides: exampleOverrides.length
      },
      meta: {
        timestamp: new Date().toISOString(),
        environment: 'development'
      }
    }
  })

  console.log('✅ Created initial audit log entry')
  console.log('🎉 Seed completed successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })