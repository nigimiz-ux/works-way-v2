import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      applicantEmail, 
      applicantName, 
      applicantDept, 
      startDate, 
      endDate, 
      leaveType, 
      reason, 
      requestedDays 
    } = body;

    // 환경변수를 사용하여 Supabase 클라이언트 초기화
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const botToken = "8380179704:AAFE-kdm6zJnzTI8molCdI6XRPUzKgPQIWU";
    const adminChatId = "5204004784"; // 기본 대표님(admin) 텔레그램 ID
    
    let targetChatId = adminChatId;
    let managerName = "대표";

    // 1. 수신자 결정 로직 (스마트 라우팅)
    if (applicantDept && applicantDept !== '경영진') {
      // 1순위: 부장, 2순위: 과장 조회 (본인 제외)
      const { data: managers, error } = await supabase
        .from('profiles')
        .select('telegram_id, full_name, position')
        .eq('department', applicantDept)
        .in('position', ['부장', '과장'])
        .neq('email', applicantEmail);

      if (!error && managers && managers.length > 0) {
        // telegram_id가 존재하는 사람만 필터링
        const validManagers = managers.filter(m => m.telegram_id);
        
        // 1순위: 부장 찾기
        let selectedManager = validManagers.find(m => m.position === '부장');
        
        // 2순위: 부장이 없으면 과장 찾기
        if (!selectedManager) {
          selectedManager = validManagers.find(m => m.position === '과장');
        }

        if (selectedManager) {
          targetChatId = selectedManager.telegram_id;
          managerName = selectedManager.full_name || selectedManager.position;
        }
      }
    }

    // 2. 메시지 포맷팅
    const leaveTypeText = leaveType === 'half' ? '반차' : '연차';
    
    const message = `🏖️ [${leaveTypeText} 결재 요청]

${managerName}님, ${applicantName}님이 연차를 신청하오니 확인하여 결재를 해 주십시오.

👤 신청자: ${applicantName} (${applicantDept || '소속 없음'})
📅 기간: ${startDate} ~ ${endDate} (${requestedDays}일)
📝 사유: ${reason}`;

    // 3. 텔레그램 발송
    const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: targetChatId,
        text: message,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Telegram API Error:', errorData);
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
    }

    return NextResponse.json({ success: true, targetChatId, managerName });
  } catch (error) {
    console.error('Error sending telegram message:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
