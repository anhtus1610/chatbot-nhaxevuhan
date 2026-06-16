import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface BookingHistoryItem {
  from: string
  to: string
  date?: string
  time?: string
  vehicleType?: string
}

export interface UserProfile {
  name: string
  phone: string
  email: string
  bookingHistory: BookingHistoryItem[]
}

interface UserState extends UserProfile {
  setUserProfile: (profile: Partial<Omit<UserProfile, 'bookingHistory'>>) => void
  addBooking: (booking: BookingHistoryItem) => void
  setBookingHistory: (history: BookingHistoryItem[]) => void
  clearUserProfile: () => void
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      name: '',
      phone: '',
      email: '',
      bookingHistory: [],
      setUserProfile: (profile) => set((state) => ({ ...state, ...profile })),
      addBooking: (booking) =>
        set((state) => ({
          bookingHistory: [...state.bookingHistory, booking],
        })),
      setBookingHistory: (history) => set({ bookingHistory: history }),
      clearUserProfile: () =>
        set({
          name: '',
          phone: '',
          email: '',
          bookingHistory: [],
        }),
    }),
    {
      name: 'vuhan_user_store',
    }
  )
)
