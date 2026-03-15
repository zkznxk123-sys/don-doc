export type UserRole = 'CFO' | 'MEMBER' | 'VIEWER'

export type Visibility = 'SHARED' | 'PRIVATE'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  familyId: string
  createdAt: Date
  updatedAt: Date
}

export interface Transaction {
  id: string
  amount: number
  description: string
  vendor: string
  date: string
  visibility: Visibility
  userId: string
  familyId: string
  createdAt: Date
  updatedAt: Date
}

export interface CreateTransactionInput {
  amount: number
  description: string
  vendor: string
  date: string
  visibility: Visibility
}

export interface GetTransactionsInput {
  familyId: string
  userId: string
  userRole: UserRole
  limit?: number
  offset?: number
}

export interface MaskedTransaction extends Omit<Transaction, 'description' | 'vendor'> {
  description: string
  vendor: string
  isMasked: boolean
}
