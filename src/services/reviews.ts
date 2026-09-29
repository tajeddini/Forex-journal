// ============================================================
// Trading Reviews Service
// Daily, Weekly, Monthly reviews
// ============================================================

import { supabase } from './supabase';
import type { TradingReview, TradingReviewInsert, TradingReviewUpdate, ReviewType } from '../types/database';

/**
 * Get all reviews for a user
 */
export async function getReviews(userId: string, type?: ReviewType): Promise<TradingReview[]> {
  let query = supabase
    .from('trading_reviews')
    .select('*')
    .eq('user_id', userId)
    .order('review_date', { ascending: false });
  
  if (type) {
    query = query.eq('review_type', type);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('Error fetching reviews:', error);
    throw new Error('خطا در دریافت بازبینی‌ها');
  }
  
  return data || [];
}

/**
 * Get a specific review
 */
export async function getReview(reviewId: string, userId: string): Promise<TradingReview | null> {
  const { data, error } = await supabase
    .from('trading_reviews')
    .select('*')
    .eq('id', reviewId)
    .eq('user_id', userId)
    .maybeSingle();
  
  if (error) {
    console.error('Error fetching review:', error);
    throw new Error('خطا در دریافت بازبینی');
  }
  
  return data;
}

/**
 * Create a new review
 */
export async function createReview(input: TradingReviewInsert): Promise<TradingReview> {
  const { data, error } = await supabase
    .from('trading_reviews')
    .insert(input)
    .select()
    .single();
  
  if (error) {
    console.error('Error creating review:', error);
    throw new Error('خطا در ایجاد بازبینی');
  }
  
  return data;
}

/**
 * Update a review
 */
export async function updateReview(
  reviewId: string,
  userId: string,
  input: TradingReviewUpdate
): Promise<TradingReview> {
  const { data, error } = await supabase
    .from('trading_reviews')
    .update(input)
    .eq('id', reviewId)
    .eq('user_id', userId)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating review:', error);
    throw new Error('خطا در بروزرسانی بازبینی');
  }
  
  return data;
}

/**
 * Delete a review
 */
export async function deleteReview(reviewId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('trading_reviews')
    .delete()
    .eq('id', reviewId)
    .eq('user_id', userId);
  
  if (error) {
    console.error('Error deleting review:', error);
    throw new Error('خطا در حذف بازبینی');
  }
}

/**
 * Get period dates for a review type
 */
export function getReviewPeriod(type: ReviewType, date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  let end = new Date(date);
  
  switch (type) {
    case 'daily':
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'weekly':
      // Start of week (Saturday for Persian calendar)
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1);
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      break;
    case 'monthly':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      break;
  }
  
  return { start, end };
}
