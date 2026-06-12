const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");

const app = express();

const ADMIN_CODE = "rockclub007#";

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "src")));

const db = mysql.createPool({
    host: "mysql",
    user: "root",
    password: "1234",
    database: "word_memory",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

function hashPassword(password) {
    return crypto.createHash("sha256").update(password).digest("hex");
}

function isAdminCode(adminCode) {
    return adminCode === ADMIN_CODE;
}

function testDBConnection() {
    db.query("SELECT 1", (err) => {
        if (err) {
            console.error("MySQL 연결 실패, 3초 후 재시도:", err.message);
            setTimeout(testDBConnection, 3000);
            return;
        }

        console.log("MySQL 연결 성공");
    });
}

testDBConnection();

function getSet(setId, callback) {
    db.query(
        "SELECT * FROM word_sets WHERE set_id = ?",
        [setId],
        (err, results) => {
            if (err) {
                callback(err);
                return;
            }

            if (results.length === 0) {
                callback(null, null);
                return;
            }

            callback(null, results[0]);
        }
    );
}

function canViewSet(setInfo, userId, adminCode, setPassword) {
    if (!setInfo) return false;

    if (isAdminCode(adminCode)) return true;

    if (setInfo.visibility === "public") return true;

    if (userId && setInfo.owner_id === Number(userId)) return true;

    if (setInfo.visibility === "private") {
        if (setInfo.set_password && setPassword) {
            return setInfo.set_password === hashPassword(setPassword);
        }
    }

    return false;
}

function canManageSet(setInfo, userId, adminCode) {
    if (!setInfo) return false;

    if (isAdminCode(adminCode)) return true;

    if (userId && setInfo.owner_id === Number(userId)) return true;

    return false;
}

app.post("/api/signup", (req, res) => {
    const { username, password, admin_code } = req.body;

    if (!username || !password) {
        res.status(400).json({ error: "아이디와 비밀번호를 입력해주세요." });
        return;
    }

    const role = isAdminCode(admin_code) ? "admin" : "user";
    const hashedPassword = hashPassword(password);

    const sql = `
        INSERT INTO users
        (username, password, role)
        VALUES (?, ?, ?)
    `;

    db.query(sql, [username, hashedPassword, role], (err, result) => {
        if (err) {
            if (err.code === "ER_DUP_ENTRY") {
                res.status(409).json({ error: "이미 존재하는 아이디입니다." });
                return;
            }

            console.error("회원가입 실패:", err);
            res.status(500).json({ error: "회원가입 실패" });
            return;
        }

        res.json({
            message: "회원가입 성공",
            user: {
                user_id: result.insertId,
                username,
                role
            }
        });
    });
});

app.post("/api/login", (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        res.status(400).json({ error: "아이디와 비밀번호를 입력해주세요." });
        return;
    }

    const hashedPassword = hashPassword(password);

    const sql = `
        SELECT user_id, username, role
        FROM users
        WHERE username = ? AND password = ?
    `;

    db.query(sql, [username, hashedPassword], (err, results) => {
        if (err) {
            console.error("로그인 실패:", err);
            res.status(500).json({ error: "로그인 실패" });
            return;
        }

        if (results.length === 0) {
            res.status(401).json({ error: "아이디 또는 비밀번호가 틀렸습니다." });
            return;
        }

        res.json({
            message: "로그인 성공",
            user: results[0]
        });
    });
});

app.get("/api/sets", (req, res) => {
    const userId = req.query.user_id;
    const adminCode = req.query.admin_code;
    const isGuest = req.query.guest === "true";

    let sql;
    let params = [];

    if (isAdminCode(adminCode)) {
        sql = `
            SELECT ws.*, u.username AS owner_name
            FROM word_sets ws
            LEFT JOIN users u ON ws.owner_id = u.user_id
            ORDER BY ws.created_at DESC
        `;
    } else if (isGuest || !userId) {
        sql = `
            SELECT ws.*, u.username AS owner_name
            FROM word_sets ws
            LEFT JOIN users u ON ws.owner_id = u.user_id
            WHERE ws.is_admin_set = TRUE
            ORDER BY ws.created_at DESC
        `;
    } else {
        sql = `
            SELECT ws.*, u.username AS owner_name
            FROM word_sets ws
            LEFT JOIN users u ON ws.owner_id = u.user_id
            WHERE ws.visibility = 'public'
               OR ws.owner_id = ?
               OR ws.is_admin_set = TRUE
            ORDER BY ws.created_at DESC
        `;
        params = [userId];
    }

    db.query(sql, params, (err, results) => {
        if (err) {
            console.error("세트 목록 조회 실패:", err);
            res.status(500).json({ error: "세트 목록 조회 실패" });
            return;
        }

        res.json(results);
    });
});

app.post("/api/sets", (req, res) => {
    const {
        title,
        description,
        visibility,
        set_password,
        user_id,
        admin_code,
        is_admin_set
    } = req.body;

    if (!title) {
        res.status(400).json({ error: "세트 이름을 입력해주세요." });
        return;
    }

    const admin = isAdminCode(admin_code);

    if (!admin && !user_id) {
        res.status(401).json({ error: "로그인 후 세트를 만들 수 있습니다." });
        return;
    }

    const finalVisibility = visibility === "private" ? "private" : "public";
    const hashedSetPassword =
        finalVisibility === "private" && set_password
            ? hashPassword(set_password)
            : null;

    const ownerId = admin && is_admin_set ? null : user_id;
    const adminSet = admin && is_admin_set ? true : false;

    const sql = `
        INSERT INTO word_sets
        (owner_id, title, description, visibility, set_password, is_admin_set)
        VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.query(
        sql,
        [ownerId, title, description || "", finalVisibility, hashedSetPassword, adminSet],
        (err, result) => {
            if (err) {
                console.error("세트 생성 실패:", err);
                res.status(500).json({ error: "세트 생성 실패" });
                return;
            }

            res.json({
                message: "세트 생성 성공",
                set_id: result.insertId
            });
        }
    );
});

app.post("/api/sets/:id/unlock", (req, res) => {
    const setId = req.params.id;
    const { set_password, user_id, admin_code } = req.body;

    getSet(setId, (err, setInfo) => {
        if (err) {
            console.error("세트 확인 실패:", err);
            res.status(500).json({ error: "세트 확인 실패" });
            return;
        }

        if (!setInfo) {
            res.status(404).json({ error: "세트를 찾을 수 없습니다." });
            return;
        }

        if (canViewSet(setInfo, user_id, admin_code, set_password)) {
            res.json({ message: "세트 열기 성공" });
            return;
        }

        res.status(403).json({ error: "비공개 세트 암호가 틀렸습니다." });
    });
});

app.get("/api/words", (req, res) => {
    const { set_id, user_id, admin_code, set_password } = req.query;

    if (!set_id) {
        res.status(400).json({ error: "세트 ID가 필요합니다." });
        return;
    }

    getSet(set_id, (err, setInfo) => {
        if (err) {
            console.error("세트 확인 실패:", err);
            res.status(500).json({ error: "세트 확인 실패" });
            return;
        }

        if (!canViewSet(setInfo, user_id, admin_code, set_password)) {
            res.status(403).json({ error: "이 세트를 볼 권한이 없습니다." });
            return;
        }

        const sql = `
            SELECT *
            FROM words
            WHERE set_id = ?
            ORDER BY created_at DESC
        `;

        db.query(sql, [set_id], (err, results) => {
            if (err) {
                console.error("단어 조회 실패:", err);
                res.status(500).json({ error: "단어 조회 실패" });
                return;
            }

            res.json(results);
        });
    });
});

app.get("/api/quiz", (req, res) => {
    const { set_id, user_id, admin_code, set_password } = req.query;

    if (!set_id) {
        res.status(400).json({ error: "세트 ID가 필요합니다." });
        return;
    }

    getSet(set_id, (err, setInfo) => {
        if (err) {
            console.error("세트 확인 실패:", err);
            res.status(500).json({ error: "세트 확인 실패" });
            return;
        }

        if (!canViewSet(setInfo, user_id, admin_code, set_password)) {
            res.status(403).json({ error: "이 세트를 사용할 권한이 없습니다." });
            return;
        }

        const sql = `
            SELECT *
            FROM words
            WHERE set_id = ?
            ORDER BY RAND()
            LIMIT 1
        `;

        db.query(sql, [set_id], (err, results) => {
            if (err) {
                console.error("퀴즈 조회 실패:", err);
                res.status(500).json({ error: "퀴즈 조회 실패" });
                return;
            }

            if (results.length === 0) {
                res.json(null);
                return;
            }

            res.json(results[0]);
        });
    });
});

app.post("/api/words", (req, res) => {
    const {
        set_id,
        word,
        meaning,
        part_of_speech,
        example_sentence,
        example_meaning,
        user_id,
        admin_code
    } = req.body;

    if (!set_id || !word || !meaning) {
        res.status(400).json({ error: "세트, 단어, 뜻은 반드시 필요합니다." });
        return;
    }

    getSet(set_id, (err, setInfo) => {
        if (err) {
            console.error("세트 확인 실패:", err);
            res.status(500).json({ error: "세트 확인 실패" });
            return;
        }

        if (!canManageSet(setInfo, user_id, admin_code)) {
            res.status(403).json({ error: "이 세트에 단어를 추가할 권한이 없습니다." });
            return;
        }

        const sql = `
            INSERT INTO words
            (set_id, word, meaning, part_of_speech, example_sentence, example_meaning)
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        db.query(
            sql,
            [set_id, word, meaning, part_of_speech || "", example_sentence || "", example_meaning || ""],
            (err, result) => {
                if (err) {
                    console.error("단어 저장 실패:", err);
                    res.status(500).json({ error: "단어 저장 실패" });
                    return;
                }

                res.json({
                    message: "단어 저장 성공",
                    word_id: result.insertId
                });
            }
        );
    });
});

app.post("/api/words/bulk", (req, res) => {
    const { set_id, words, user_id, admin_code } = req.body;

    if (!set_id || !Array.isArray(words) || words.length === 0) {
        res.status(400).json({ error: "저장할 단어가 없습니다." });
        return;
    }

    getSet(set_id, (err, setInfo) => {
        if (err) {
            console.error("세트 확인 실패:", err);
            res.status(500).json({ error: "세트 확인 실패" });
            return;
        }

        if (!canManageSet(setInfo, user_id, admin_code)) {
            res.status(403).json({ error: "이 세트에 단어를 추가할 권한이 없습니다." });
            return;
        }

        const values = words.map(item => [
            set_id,
            item.word,
            item.meaning,
            item.part_of_speech || "",
            item.example_sentence || "",
            item.example_meaning || ""
        ]);

        const sql = `
            INSERT INTO words
            (set_id, word, meaning, part_of_speech, example_sentence, example_meaning)
            VALUES ?
        `;

        db.query(sql, [values], (err) => {
            if (err) {
                console.error("대량 단어 저장 실패:", err);
                res.status(500).json({ error: "대량 단어 저장 실패" });
                return;
            }

            res.json({
                message: "대량 단어 저장 성공",
                inserted_count: values.length
            });
        });
    });
});

app.delete("/api/words/:id", (req, res) => {
    const wordId = req.params.id;
    const { user_id, admin_code } = req.body;

    const findSql = `
        SELECT w.*, ws.owner_id
        FROM words w
        JOIN word_sets ws ON w.set_id = ws.set_id
        WHERE w.word_id = ?
    `;

    db.query(findSql, [wordId], (err, results) => {
        if (err) {
            console.error("단어 확인 실패:", err);
            res.status(500).json({ error: "단어 확인 실패" });
            return;
        }

        if (results.length === 0) {
            res.status(404).json({ error: "단어를 찾을 수 없습니다." });
            return;
        }

        const wordInfo = results[0];

        if (!isAdminCode(admin_code) && Number(wordInfo.owner_id) !== Number(user_id)) {
            res.status(403).json({ error: "단어를 삭제할 권한이 없습니다." });
            return;
        }

        db.query("DELETE FROM words WHERE word_id = ?", [wordId], (err) => {
            if (err) {
                console.error("단어 삭제 실패:", err);
                res.status(500).json({ error: "단어 삭제 실패" });
                return;
            }

            res.json({ message: "단어 삭제 성공" });
        });
    });
});

app.post("/api/quiz-logs", (req, res) => {
    const { user_id, word_id, user_answer, is_correct } = req.body;

    const sql = `
        INSERT INTO quiz_logs
        (user_id, word_id, user_answer, is_correct)
        VALUES (?, ?, ?, ?)
    `;

    db.query(sql, [user_id || null, word_id, user_answer, is_correct], (err) => {
        if (err) {
            console.error("퀴즈 기록 저장 실패:", err);
            res.status(500).json({ error: "퀴즈 기록 저장 실패" });
            return;
        }

        res.json({ message: "퀴즈 기록 저장 성공" });
    });
});

app.post("/api/wrong-notes", (req, res) => {
    const { user_id, word_id } = req.body;

    const findSql = `
        SELECT wrong_id, wrong_count
        FROM wrong_notes
        WHERE word_id = ? AND (user_id <=> ?)
    `;

    db.query(findSql, [word_id, user_id || null], (err, results) => {
        if (err) {
            console.error("오답 노트 확인 실패:", err);
            res.status(500).json({ error: "오답 노트 확인 실패" });
            return;
        }

        if (results.length > 0) {
            const updateSql = `
                UPDATE wrong_notes
                SET wrong_count = wrong_count + 1,
                    last_wrong_at = CURRENT_TIMESTAMP
                WHERE wrong_id = ?
            `;

            db.query(updateSql, [results[0].wrong_id], (err) => {
                if (err) {
                    console.error("오답 노트 업데이트 실패:", err);
                    res.status(500).json({ error: "오답 노트 업데이트 실패" });
                    return;
                }

                res.json({ message: "오답 노트 업데이트 성공" });
            });

            return;
        }

        const insertSql = `
            INSERT INTO wrong_notes
            (user_id, word_id, wrong_count)
            VALUES (?, ?, 1)
        `;

        db.query(insertSql, [user_id || null, word_id], (err) => {
            if (err) {
                console.error("오답 노트 저장 실패:", err);
                res.status(500).json({ error: "오답 노트 저장 실패" });
                return;
            }

            res.json({ message: "오답 노트 저장 성공" });
        });
    });
});

app.get("/api/wrong-notes", (req, res) => {
    const { user_id } = req.query;

    const sql = `
        SELECT 
            wn.wrong_id,
            wn.wrong_count,
            wn.last_wrong_at,
            w.word,
            w.meaning,
            w.part_of_speech
        FROM wrong_notes wn
        JOIN words w ON wn.word_id = w.word_id
        WHERE wn.user_id <=> ?
        ORDER BY wn.last_wrong_at DESC
    `;

    db.query(sql, [user_id || null], (err, results) => {
        if (err) {
            console.error("오답 노트 조회 실패:", err);
            res.status(500).json({ error: "오답 노트 조회 실패" });
            return;
        }

        res.json(results);
    });
});

app.listen(3000, () => {
    console.log("서버 실행 중: http://localhost:3000");
});