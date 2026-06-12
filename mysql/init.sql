CREATE DATABASE IF NOT EXISTS word_memory;
USE word_memory;

DROP TABLE IF EXISTS quiz_logs;
DROP TABLE IF EXISTS wrong_notes;
DROP TABLE IF EXISTS words;
DROP TABLE IF EXISTS word_sets;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE word_sets (
    set_id INT AUTO_INCREMENT PRIMARY KEY,
    owner_id INT NULL,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    visibility VARCHAR(20) DEFAULT 'public',
    set_password VARCHAR(255) NULL,
    is_admin_set BOOLEAN DEFAULT FALSE,
    admin_approved BOOLEAN DEFAULT FALSE,
    guest_only BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(user_id)
        ON DELETE SET NULL
);

CREATE TABLE words (
    word_id INT AUTO_INCREMENT PRIMARY KEY,
    set_id INT NOT NULL,
    word VARCHAR(100) NOT NULL,
    meaning VARCHAR(255) NOT NULL,
    part_of_speech VARCHAR(50),
    example_sentence TEXT,
    example_meaning TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (set_id) REFERENCES word_sets(set_id)
        ON DELETE CASCADE
);

CREATE TABLE wrong_notes (
    wrong_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    word_id INT NOT NULL,
    wrong_count INT DEFAULT 1,
    last_wrong_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE CASCADE,
    FOREIGN KEY (word_id) REFERENCES words(word_id)
        ON DELETE CASCADE
);

CREATE TABLE quiz_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    word_id INT NOT NULL,
    user_answer VARCHAR(255),
    is_correct BOOLEAN NOT NULL,
    solved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE SET NULL,
    FOREIGN KEY (word_id) REFERENCES words(word_id)
        ON DELETE CASCADE
);

INSERT INTO word_sets
(title, description, visibility, is_admin_set, admin_approved, guest_only)
VALUES
('관리자 기본 세트', '비회원도 사용할 수 있는 기본 단어 세트입니다.', 'public', TRUE, TRUE, TRUE);