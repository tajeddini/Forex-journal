// ============================================================
// Trading Reviews Service
// Daily, Weekly, Monthly reviews
// ============================================================

import { supabase, isSupabaseConfigured } from './supabase';
import { MockStorage } from './mockStorage';
import type { TradingReview, TradingReviewInsert, TradingReviewUpdate, ReviewType } from '../types/database';

/**
 * Get all reviews for a user
 */
export async function getReviews(userId: string, type?: ReviewType): Promise<TradingReview[]> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    return MockStorage.getReviews(userId, type);
  }

  try {
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
      console.warn('Falling back to local reviews storage due to Supabase error:', error.message);
      return MockStorage.getReviews(userId, type);
    }
    
    return data || [];
  } catch (err) {
    console.warn('Failed to query Supabase reviews, using local storage fallback:', err);
    return MockStorage.getReviews(userId, type);
  }
}

/**
 * Get a specific review
 */
export async function getReview(reviewId: string, userId: string): Promise<TradingReview | null> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    return MockStorage.getReview(reviewId, userId);
  }

  try {
    const { data, error } = await supabase
      .from('trading_reviews')
      .select('*')
      .eq('id', reviewId)
      .eq('user_id', userId)
      .maybeSingle();
    
    if (error) {
      console.warn('Falling back to local review storage due to Supabase error:', error.message);
      return MockStorage.getReview(reviewId, userId);
    }
    
    return data;
  } catch {
    return MockStorage.getReview(reviewId, userId);
  }
}

/**
 * Create a new review
 */
export async function createReview(input: TradingReviewInsert): Promise<TradingReview> {
  if (!isSupabaseConfigured || input.user_id === 'guest-demo-user') {
    return MockStorage.createReview(input);
  }

  try {
    const { data, error } = await supabase
      .from('trading_reviews')
      .insert(input)
      .select()
      .single();
    
    if (error) {
      console.warn('Supabase insert failed, storing review locally:', error.message);
      return MockStorage.createReview(input);
    }
    
    return data;
  } catch {
    return MockStorage.createReview(input);
  }
}

/**
 * Update a review
 */
export async function updateReview(
  reviewId: string,
  userId: string,
  input: TradingReviewUpdate
): Promise<TradingReview> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    return MockStorage.updateReview(reviewId, input);
  }

  try {
    const { data, error } = await supabase
      .from('trading_reviews')
      .update(input)
      .eq('id', reviewId)
      .eq('user_id', userId)
      .select()
      .single();
    
    if (error) {
      console.warn('Supabase update failed, updating review locally:', error.message);
      return MockStorage.updateReview(reviewId, input);
    }
    
    return data;
  } catch {
    return MockStorage.updateReview(reviewId, input);
  }
}

/**
 * Delete a review
 */
export async function deleteReview(reviewId: string, userId: string): Promise<void> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    return MockStorage.deleteReview(reviewId);
  }

  try {
    const { error } = await supabase
      .from('trading_reviews')
      .delete()
      .eq('id', reviewId)
      .eq('user_id', userId);
    
    if (error) {
      console.warn('Supabase delete failed, deleting review locally:', error.message);
      return MockStorage.deleteReview(reviewId);
    }
  } catch {
    return MockStorage.deleteReview(reviewId);
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
