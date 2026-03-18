'use client'

import { Plus, FileUp } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

interface AddEntryActionProps {
  onAddTransaction: () => void
  onExcelUpload: () => void
}

export function AddEntryAction({ onAddTransaction, onExcelUpload }: AddEntryActionProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 px-3 py-2 md:px-4 bg-white text-black rounded-lg text-xs md:text-sm font-semibold hover:bg-zinc-200 transition-colors active:scale-[0.97]">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">새 내역 추가</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onAddTransaction}>
          <Plus className="w-4 h-4 text-zinc-400" />
          직접 입력
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onExcelUpload}>
          <FileUp className="w-4 h-4 text-zinc-400" />
          엑셀 파일 업로드
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
