'use server'

import { supabase } from '@/lib/supabase'
import { User, UserRole } from '@/lib/types'

/**
 * 현재 사용자 정보와 역할 가져오기
 */
export async function getCurrentUserWithRole(): Promise<User & { role: UserRole }> {
  try {
    const authUser = await supabase.auth.getUser()
    const { user } = authUser.data
    
    if (!user) {
      throw new Error('인증되지 않은 사용자입니다.')
    }

    const { data: userProfile, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error || !userProfile) {
      throw new Error('사용자 프로필을 찾을 수 없습니다.')
    }

    return userProfile

  } catch (error) {
    console.error('getCurrentUserWithRole 오류:', error)
    throw error
  }
}

/**
 * 가족 구성원 목록 가져오기
 */
export async function getFamilyMembers(familyId: string): Promise<User[]> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('familyId', familyId)
      .order('createdAt', { ascending: true })

    if (error) {
      throw new Error('가족 구성원을 가져오는데 실패했습니다.')
    }

    return data || []

  } catch (error) {
    console.error('getFamilyMembers 오류:', error)
    throw error
  }
}

/**
 * 사용자 역할 확인
 */
export async function checkUserRole(userId: string): Promise<UserRole> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single()

    if (error || !data) {
      throw new Error('사용자 역할을 확인할 수 없습니다.')
    }

    return data.role

  } catch (error) {
    console.error('checkUserRole 오류:', error)
    throw error
  }
}

/**
 * CFO 권한 확인
 */
export async function isCFO(userId: string): Promise<boolean> {
  const role = await checkUserRole(userId)
  return role === 'CFO'
}

/**
 * 특정 작업에 대한 권한 확인
 */
export async function hasPermission(
  userId: string, 
  action: 'read' | 'write' | 'delete',
  targetUserId?: string
): Promise<boolean> {
  try {
    const userRole = await checkUserRole(userId)
    
    switch (userRole) {
      case 'CFO':
        return true // CFO는 모든 권한 가짐
        
      case 'MEMBER':
        if (action === 'read') return true
        if (action === 'write' && !targetUserId) return true
        if (action === 'write' && targetUserId === userId) return true
        return false
        
      case 'VIEWER':
        return action === 'read'
        
      default:
        return false
    }

  } catch (error) {
    console.error('hasPermission 오류:', error)
    return false
  }
}
