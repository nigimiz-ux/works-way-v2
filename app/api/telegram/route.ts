import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, usageDate, merchant, amount, purpose } = body;

    // 환경변수를 사용하여 Supabase 클라이언트 초기화
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // email을 이용해 profiles 테이블에서 사용자 정보 조회
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, position, department')
      .eq('email', email)
      .single();

    const fullName = profile?.full_name || email;
    const position = profile?.position ? ` ${profile.position}` : "";
    const department = profile?.department ? ` (${profile.department})` : "";
    
    const reporterString = `${fullName}${position}${department}`;

    const botToken = "8380179704:AAFE-kdm6zJnzTI8molCdI6XRPUzKgPQIWU";
    const chatId = "5204004784";

    const formattedAmount = Number(amount).toLocaleString();

    const message = `💳 [법인카드 사용 보고]

보고자: ${reporterString}
사용일자: ${usageDate}
사용처: ${merchant}
금액: ${formattedAmount}원
사유: ${purpose}`;

    const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

    const response = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Telegram API Error:', errorData);
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error sending telegram message:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
