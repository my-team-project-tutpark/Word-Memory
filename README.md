# 🧠 Word Memory

영단어(또는 외국어 단어)를 등록하고 퀴즈로 암기할 수 있는 웹 기반 단어 학습 서비스입니다.

서비스 주소: https://word-memory.onrender.com

## 주요 기능

- **단어 세트 관리**: 공개/비공개 단어 세트 생성 및 선택
- **퀴즈 모드**
  - 단어 보고 뜻 맞추기
  - 뜻 보고 단어 맞추기
  - 섞어서 출제
- **단어 등록**
  - 개별 등록 (단어 / 품사 / 뜻 / 예문 / 예문 뜻)
  - 대량 등록 (한 줄에 하나씩, `단어, 뜻, 품사, 예문, 예문 뜻` 형식)
- **오답 노트**: 틀린 단어와 틀린 횟수, 최근 오답일 자동 기록
- **회원 시스템**: 회원가입 / 로그인 / 비회원 모드 지원
- **관리자 기능**
  - 관리자 전용 세트 등록 및 승인
  - 비회원 전용 세트 지정
  - 회원 목록 조회 및 강제 탈퇴

## 사용 흐름

1. 시작 화면에서 **회원 로그인 / 회원가입 / 비회원 시작** 중 선택
2. **세트 선택** 탭에서 사용할 단어 세트를 고르거나 새로 생성
3. **단어 등록** 또는 **대량 등록** 탭에서 단어 데이터 입력
4. **퀴즈** 탭에서 학습 모드를 선택해 퀴즈 진행 (`Enter`: 정답 확인, `Space`: 다음 단어)
5. 틀린 단어는 **오답 노트**에 자동으로 누적되어 복습 가능

## 기술 스택 (추정)

- **Frontend**: HTML/CSS/JS 기반 SPA
- **Backend**: Node.js (또는 유사 서버) — Render에 배포
- **Database**: MySQL
- **Hosting**: Render

## 데이터베이스 (MySQL)

화면 구성을 바탕으로 추정한 테이블 구조 예시입니다. 실제 서비스의 스키마와는 다를 수 있으니 참고용으로 사용하세요.

```sql
-- 회원 테이블
CREATE TABLE users (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    username    VARCHAR(50) NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,      -- 해시 저장
    role        ENUM('user', 'admin') DEFAULT 'user',
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 단어 세트 테이블
CREATE TABLE word_sets (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    title           VARCHAR(100) NOT NULL,
    description     VARCHAR(255),
    owner_id        INT,                       -- users.id (비회원 세트는 NULL 가능)
    is_public       BOOLEAN DEFAULT TRUE,
    is_admin_set    BOOLEAN DEFAULT FALSE,
    is_approved     BOOLEAN DEFAULT FALSE,      -- 관리자 승인 여부
    guest_only      BOOLEAN DEFAULT FALSE,      -- 비회원 전용 세트 여부
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id)
);

-- 단어 테이블
CREATE TABLE words (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    set_id          INT NOT NULL,
    word            VARCHAR(100) NOT NULL,
    part_of_speech  ENUM('명사', '동사', '형용사', '부사') NULL,
    meaning         VARCHAR(255) NOT NULL,
    example         VARCHAR(255),
    example_meaning VARCHAR(255),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (set_id) REFERENCES word_sets(id) ON DELETE CASCADE
);

-- 오답 노트 테이블
CREATE TABLE wrong_answers (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT,                       -- 비회원은 NULL 또는 세션 기반 처리
    word_id         INT NOT NULL,
    wrong_count     INT DEFAULT 1,
    last_wrong_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
);
```

### 참고 사항

- `word_sets.is_admin_set` + `is_approved` 조합으로 **관리자 세트의 승인 워크플로우**를 구현한 것으로 보입니다.
- `guest_only` 컬럼으로 비회원 전용 세트를 별도 관리합니다.
- 비회원 사용 시에는 세션/로컬 저장 방식으로 데이터를 다룰 가능성이 있어, `user_id`가 NULL인 경우를 고려한 설계가 필요합니다.

## 향후 개선 아이디어

- 단어 세트 검색/필터 기능
- 퀴즈 결과 통계 (정답률, 학습 시간 등) 시각화
- 단어 발음(TTS) 지원
- 다국어(영/한 외 추가 언어) 세트 지원

