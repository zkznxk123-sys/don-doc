'use server'

import { supabase } from '@/lib/supabase'
import { 
  Transaction, 
  GetTransactionsInput, 
  MaskedTransaction, 
  UserRole, 
  Visibility 
} from '@/lib/types'

/**
 * 사용자 역할과 투명성 설정에 따라 거래 내역을 가져오는 서버 액션
 * - CFO: 모든 거래 접근 가능
 * - MEMBER: 본인 및 SHARED 거래만 접근 가능
 * - PRIVATE 거래는 서버 단계에서 마스킹 처리
 */
export async function getTransactions(input: GetTransactionsInput): Promise<MaskedTransaction[]> {
  const { familyId, userId, userRole, limit = 50, offset = 0 } = input

  try {
    let query = supabase
      .from('transactions')
      .select('*')
      .eq('familyId', familyId)
      .order('date', { ascending: false })
      .range(offset, offset + limit - 1)

    // 역할에 따라 데이터 필터링
    if (userRole !== 'CFO') {
      // CFO가 아닌 경우: 본인 거래 또는 SHARED 거래만 가져오기
      query = query.or(`userId.eq.${userId},visibility.eq.SHARED`)
    }

    const { data: transactions, error } = await query

    if (error) {
      console.error('거래 내역 조회 오류:', error)
      throw new Error('거래 내역을 가져오는데 실패했습니다.')
    }

    if (!transactions || transactions.length === 0) {
      return []
    }

    // 서버 단계에서 투명성 로직 적용
    const maskedTransactions = transactions.map(transaction => 
      maskTransactionData(transaction, userId, userRole)
    )

    return maskedTransactions

  } catch (error) {
    console.error('getTransactions 서버 액션 오류:', error)
    throw error
  }
}

/**
 * 거래 데이터에 투명성 마스킹 적용
 * - 본인 거래: 모든 정보 유지
 * - 타인 SHARED 거래: 모든 정보 유지
 * - 타인 PRIVATE 거래: description과 vendor 마스킹
 */
function maskTransactionData(
  transaction: Transaction, 
  currentUserId: string, 
  userRole: UserRole
): MaskedTransaction {
  const isOwnTransaction = transaction.userId === currentUserId
  
  // 본인 거래이거나 SHARED 거래인 경우 마스킹 없음
  if (isOwnTransaction || transaction.visibility === 'SHARED') {
    return {
      ...transaction,
      isMasked: false
    }
  }

  // 타인의 PRIVATE 거래인 경우 마스킹 적용
  return {
    ...transaction,
    description: '🔒 개인 지출',
    vendor: '🔒 개인 지출',
    isMasked: true
  }
}

/**
 * 특정 거래 상세 정보 조회 (단일 거래)
 */
export async function getTransactionById(
  transactionId: string, 
  userId: string, 
  userRole: UserRole
): Promise<MaskedTransaction | null> {
  try {
    const { data: transaction, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single()

    if (error || !transaction) {
      return null
    }

    // 접근 권한 확인
    if (userRole !== 'CFO' && 
        transaction.userId !== userId && 
        transaction.visibility !== 'SHARED') {
      throw new Error('접근 권한이 없습니다.')
    }

    return maskTransactionData(transaction, userId, userRole)

  } catch (error) {
    console.error('getTransactionById 오류:', error)
    throw error
  }
}

/**
 * 새로운 거래 생성
 */
export async function createTransaction(
  transactionData: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string,
  userRole: UserRole
): Promise<Transaction> {
  try {
    // 거래 생성 권한 확인
    if (userRole === 'VIEWER') {
      throw new Error('거래를 생성할 권한이 없습니다.')
    }

    const { data, error } = await supabase
      .from('transactions')
      .insert([transactionData])
      .select()
      .single()

    if (error || !data) {
      throw new Error('거래 생성에 실패했습니다.')
    }

    return data

  } catch (error) {
    console.error('createTransaction 오류:', error)
    throw error
  }
}

/**
 * 거래 수정 (본인 거래 또는 CFO만 가능)
 */
export async function updateTransaction(
  transactionId: string,
  updateData: Partial<Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'userId' | 'familyId'>>,
  userId: string,
  userRole: UserRole
): Promise<Transaction> {
  try {
    // 기존 거래 정보 조회
    const { data: existingTransaction, error: fetchError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single()

    if (fetchError || !existingTransaction) {
      throw new Error('거래를 찾을 수 없습니다.')
    }

    // 수정 권한 확인
    const canEdit = userRole === 'CFO' || existingTransaction.userId === userId
    if (!canEdit) {
      throw new Error('수정할 권한이 없습니다.')
    }

    const { data, error } = await supabase
      .from('transactions')
      .update(updateData)
      .eq('id', transactionId)
      .select()
      .single()

    if (error || !data) {
      throw new Error('거래 수정에 실패했습니다.')
    }

    return data

  } catch (error) {
    console.error('updateTransaction 오류:', error)
    throw error
  }
}
