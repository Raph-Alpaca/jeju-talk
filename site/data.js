/*
 * 주소·코드·발표 정보를 모아 둔 파일.
 * 발표 직전에 값이 바뀌면 이 파일만 고치면 됩니다. (LINKS.md와 같은 내용)
 * 비워 둔 값("")은 화면에서 "준비 중"으로 보입니다.
 */
window.SITE = {
  // 발표 정보
  talk: {
    // 발표 제목. 쌍점(:) 뒤는 표지에서 작은 부제로 보입니다
    title: "코딩 0줄, 성취기준 1줄로 만드는 우리 교과 AI 학습 앱: 바이브 코딩 거꾸로 설계 수업",
    event: "2026 창의융합교육 한마당",
    track: "AI SW 분야",
    date: "2026. 11. 28.(토)",
    period: "13:00~13:50", // 교시(시간)
    room: "", // 강의실
    speaker: "알파카쌤 조승호",
    school: "서울 거원중학교",
    contact: "", // 사이트에 적을 연락처
    closingLine: "", // 마무리 한 줄. 비우면 "AI는 도구, 설계는 학생과 교사가 합니다"를 씁니다
    siteUrl: "https://raph-alpaca.github.io/jeju-talk/" // 배포한 사이트 주소. "이 사이트 다시 보기"와 마지막 장면의 QR이 이 주소로 만들어집니다
  },

  // 1부. AI로 바이브하다
  part1: {
    slidesTemplate: "https://docs.google.com/presentation/d/1i077AqxT2GkhH5OKn2f_u7QiA7juCR6w1s7UGugub_s/edit?usp=sharing",
    padlet: "" // 학생 자료 패들렛. 비워 두면 단추 없이 "다른 창에서 보여 드립니다"만 보입니다 (발표 모드 전용)
  },

  // 2부. 우리가 만드는 디지털 과학책
  part2: {
    studentSite: "https://sci-shelf.netlify.app/",
    teacherSite: "https://sci-teacher.netlify.app/",
    shelfCode: "GEO-2026-3JT5", // 연수용 책장 코드. 실습 장면의 QR(…/w/코드)과 연수용 책장 주소(…/c/코드)가 이 값으로 만들어집니다
    practicePadlet: "https://padlet.com/alpacaT/261128", // 실습 안내용 패들렛. 쓰지 않으면 비워 둡니다
    previewShelf: "https://sci-shelf.netlify.app/shelf.html?code=DEMO-2026-BOOK&demo=1", // 미리보기 책장 (교사용 책자 28쪽 QR)
    tour: "https://sci-teacher.netlify.app/teacher.html?demo=1&tour=1", // 둘러보기 (교사용 책자 28쪽 QR)
    video: "11.17. 송례중 공개 수업 영상.mp4", // site/media 안의 영상 파일 이름
    teacherBookFile: "교사용 책자(수정본).pdf", // site/media 안의 파일 이름. 발표 노트북에서만 "펼쳐 보기"로 열립니다
    studentBookFile: "학생용 책자(수정본).pdf"
  },

  // 3부. 과학을 잇(IT)다
  part3: {
    groupName: "AI융합교육 교사연구회 「AI와 과학을 IT다」", // 연구회 이름 표기 (포스터 표기)
    netzero: "https://scienceisjo.github.io/ai-science-it/",
    fossil: "https://scienceisjo.github.io/ai-science-it/fossil-detectives/",
    teacher: "https://scienceisjo.github.io/ai-science-it/class-guide.html", // 선생님 화면 따라 하기
    video: "활용 영상.mp4" // site/media 안의 영상 파일 이름
  },

  // 복습 모드에서 내려받기 허용 여부: "예" 또는 "아니오".
  // "예"로 바꾸려면 해당 PDF를 site/files/ 에 아래 이름으로 넣어야 합니다.
  downloads: {
    teacherBook: "아니오", // site/files/teacher-book.pdf
    studentBook: "아니오", // site/files/student-book.pdf
    bookPosters: "아니오", // site/files/book-poster-guide.pdf, site/files/book-poster-class.pdf
    itPoster: "아니오", // site/files/it-poster.pdf
    vibeTemplate: "아니오" // (PDF 원본이 없어 지금은 쓰지 않습니다)
  }
};
