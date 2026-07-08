console.log("🔥 서버 시작");

const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const session = require("express-session");

const app = express();

app.use(cors({
    origin: "http://localhost:5500",
    credentials: true
}));

app.use(express.json({ limit: "50mb" }));

app.use((req,res,next)=>{

    res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, private"
    );

    res.setHeader("Pragma","no-cache");

    res.setHeader("Expires","0");

    next();
});

app.use(session({
    secret: "secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: false
    }
}));

// DB 연결
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "1217",
    database: "event_board"
});

db.connect(err=>{
    if(err) console.error(err);
    else console.log("✅ DB 연결 성공!");
});

/* -------------------------
테스트
------------------------- */
app.get("/", (req,res)=>{
    res.send("서버 + DB 연결 성공!");
});

/* -------------------------
게시글 목록
------------------------- */
app.get("/posts", (req,res)=>{
    db.query("SELECT * FROM posts ORDER BY created_at DESC", (err, result)=>{
        if(err) return res.status(500).send("DB 조회 실패");
        res.json(result);
    });
});

/* -------------------------
게시글 작성 (로그인 필요)
------------------------- */
app.post("/posts", (req,res)=>{

    if(!req.session.user){
        return res.status(401).send("로그인 필요");
    }

    const user = req.session.user;   // ⭐ 이 줄 추가

    const {
    title,
    topics,
    categories,
    scale,
    startDate,
    endDate,
    startTime,
    endTime,
    place,
    summary,
    cardImage,
    lat,
    lng
    } = req.body;

    const sql = `
    INSERT INTO posts
    (title, topics, categories, scale, start_date, end_date, start_time, end_time, place, summary, card_image, lat, lng, user_id, username)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(sql, [
    title,
    JSON.stringify(topics),
    JSON.stringify(categories),
    scale,
    startDate,
    endDate,
    startTime,
    endTime,
    place,
    summary,
    cardImage,
    lat,
    lng,
    user.id,
    user.username
], (err)=>{
        if(err) return res.status(500).send("DB 저장 실패");
        res.send("저장 성공!");
    });
});

app.delete("/posts/:id", (req, res) => {

    if(!req.session.user){
        return res.status(401).send("로그인 필요");
    }

    const postId = req.params.id;
    const user = req.session.user;

    // 작성자 확인
    const checkSql = "SELECT user_id FROM posts WHERE id = ?";

    db.query(checkSql, [postId], (err, result) => {
        if(err) return res.status(500).send("DB 오류");

        if(result.length === 0){
            return res.status(404).send("게시글 없음");
        }

        if(result[0].user_id !== user.id &&
    user.is_admin !== 1){
            return res.status(403).send("삭제 권한 없음");
        }

        // 삭제 실행
        const deleteSql = "DELETE FROM posts WHERE id = ?";

        db.query(deleteSql, [postId], (err) => {
            if(err) return res.status(500).send("삭제 실패");
            res.send("삭제 성공");
        });
    });
});

app.get("/posts/:id", (req, res) => {

    const postId = req.params.id;

    db.query("SELECT * FROM posts WHERE id = ?", [postId], (err, result) => {
        if(err) return res.status(500).send("DB 오류");

        if(result.length === 0){
            return res.status(404).send("게시글 없음");
        }

        res.json(result[0]);
    });
});

app.put("/posts/:id", (req, res) => {

    if(!req.session.user){
        return res.status(401).send("로그인 필요");
    }

    const postId = req.params.id;
    const user = req.session.user;

    const {
    title,
    topics,
    categories,
    scale,
    startDate,
    endDate,
    startTime,
    endTime,
    place,
    summary,
    cardImage,
    lat,
    lng
    } = req.body;

    // 작성자 확인
    const checkSql =
        "SELECT user_id FROM posts WHERE id = ?";

    db.query(checkSql, [postId], (err, result) => {

        if(err){
            return res.status(500).send("DB 오류");
        }

        if(result.length === 0){
            return res.status(404).send("게시글 없음");
        }

        if(result[0].user_id !== user.id){
            return res.status(403).send("수정 권한 없음");
        }

        // 수정 실행
        const updateSql = `
        UPDATE posts
        SET
            title=?,
            topics=?,
            categories=?,
            scale=?,
            start_date=?,
            end_date=?,
            start_time=?,
            end_time=?,
            place=?,
            summary=?,
            card_image=?,
            lat=?,
            lng=?
        WHERE id=?
        `;

        db.query(
            updateSql,
            [
                title,
                JSON.stringify(topics),
                JSON.stringify(categories),
                scale,
                startDate,
                endDate,
                startTime,
                endTime,
                place,
                summary,
                cardImage,
                lat,
                lng,
                postId
            ],
            (err)=>{

                if(err){
                    console.error(err);
                    return res.status(500).send("수정 실패");
                }

                res.send("수정 성공");
            }
        );
    });
});

app.post("/posts/:id/view", (req, res) => {

    const postId = req.params.id;

    const sql =
        "UPDATE posts SET views = views + 1 WHERE id = ?";

    db.query(sql, [postId], (err)=>{

        if(err){
            return res.status(500).send("조회수 증가 실패");
        }

        // 로그인 유저면 조회 기록 저장
        if(req.session.user){

            const userId = req.session.user.id;

            db.query(
                `
                INSERT INTO post_views
                (user_id, post_id)
                VALUES (?, ?)
                `,
                [userId, postId]
            );
        }

        res.send("조회수 증가");
    });
});

app.post("/posts/:id/like", (req, res) => {

    if(!req.session.user){
        return res.status(401).send("로그인 필요");
    }

    const userId = req.session.user.id;
    const postId = req.params.id;

    // 이미 눌렀는지 확인
    const checkSql = "SELECT * FROM likes WHERE user_id=? AND post_id=?";

    db.query(checkSql, [userId, postId], (err, result)=>{

        if(result.length > 0){
            // 👉 좋아요 취소
            const deleteSql = "DELETE FROM likes WHERE user_id=? AND post_id=?";
            db.query(deleteSql, [userId, postId], ()=>{
                res.json({ liked:false });
            });
        }else{
            // 👉 좋아요 추가
            const insertSql = "INSERT INTO likes (user_id, post_id) VALUES (?, ?)";
            db.query(insertSql, [userId, postId], ()=>{
                res.json({ liked:true });
            });
        }

    });
});

app.get("/posts/:id/likes", (req, res) => {

    const postId = req.params.id;

    const sql = "SELECT COUNT(*) AS count FROM likes WHERE post_id=?";

    db.query(sql, [postId], (err, result)=>{
        res.json({ count: result[0].count });
    });
});

app.get("/posts/:id/liked", (req, res) => {

    if(!req.session.user){
        return res.json({ liked:false });
    }

    const userId = req.session.user.id;
    const postId = req.params.id;

    const sql = "SELECT * FROM likes WHERE user_id=? AND post_id=?";

    db.query(sql, [userId, postId], (err, result)=>{
        res.json({ liked: result.length > 0 });
    });
});

app.post("/comments", (req, res) => {

    if(!req.session.user){
        return res.status(401).send("로그인 필요");
    }

    const { post_id, content } = req.body;
    const user = req.session.user;

    const sql = `
    INSERT INTO comments (post_id, user_id, username, content)
    VALUES (?, ?, ?, ?)
    `;

    db.query(sql, [post_id, user.id, user.username, content], (err)=>{
        if(err) return res.status(500).send("댓글 작성 실패");
        res.send("댓글 작성 완료");
    });
});

app.get("/comments/:postId", (req, res) => {

    const postId = req.params.postId;

    const sql = `
    SELECT * FROM comments
    WHERE post_id = ?
    ORDER BY created_at ASC
    `;

    db.query(sql, [postId], (err, result)=>{
        if(err) return res.status(500).send("댓글 조회 실패");
        res.json(result);
    });
});

app.delete("/comments/:id", (req, res) => {

    if(!req.session.user){
        return res.status(401).send("로그인 필요");
    }

    const commentId = req.params.id;
    const user = req.session.user;

    const checkSql = "SELECT user_id FROM comments WHERE id=?";

    db.query(checkSql, [commentId], (err, result)=>{

        if(result.length === 0){
            return res.status(404).send("댓글 없음");
        }

        if(result[0].user_id !== user.id && user.is_admin !== 1){
            return res.status(403).send("삭제 권한 없음");
        }

        db.query("DELETE FROM comments WHERE id=?", [commentId], ()=>{
            res.send("삭제 완료");
        });
    });
});

/* -------------------------
회원가입
------------------------- */
app.post("/signup", (req, res) => {

    console.log("🔥 signup 요청 들어옴"); 

    const { username, email, password } = req.body;

    const sql = "INSERT INTO users (username, email, password) VALUES (?, ?, ?)";

    db.query(sql, [username, email, password], (err) => {
        if (err) return res.status(500).send("회원가입 실패");
        res.send("회원가입 성공!");
    });
});

/* -------------------------
로그인
------------------------- */
app.post("/login", (req, res) => {

    const { username, password } = req.body;

    const sql = "SELECT * FROM users WHERE username = ? AND password = ?";

    db.query(sql, [username, password], (err, result) => {

        if(result.length === 0){
            return res.status(401).send("로그인 실패");
        }

        req.session.user = result[0];

        res.send("로그인 성공");
    });
});

/* -------------------------
로그인 상태 확인
------------------------- */
app.get("/me", (req, res) => {

    if(req.session.user){
        res.json(req.session.user);
    }else{
        res.status(401).send("로그인 안됨");
    }

});

/* -------------------------
로그아웃
------------------------- */
app.post("/logout",(req,res)=>{

    req.session.destroy(err=>{

        if(err){
            return res.status(500).send("로그아웃 실패");
        }

        res.clearCookie("connect.sid", {
            path: "/"
        });

        res.send("로그아웃 완료");
    });
});


app.listen(3000, ()=>{
    console.log("🚀 서버 실행됨");
});

app.get("/recommend", (req, res) => {

    if(!req.session.user){
        return res.json([]);
    }

    const userId = req.session.user.id;

    // 사용자가 많이 본 태그 분석
    const sql = `
    SELECT topics, categories
    FROM posts
    WHERE id IN (
        SELECT post_id
        FROM post_views
        WHERE user_id = ?
    )
    `;

    db.query(sql, [userId], (err, results)=>{

        if(err){
            return res.status(500).send("추천 실패");
        }

        const tagCount = {};

        // 태그 빈도 계산
        results.forEach(post=>{

            const topics =
    typeof post.topics === "string"
    && post.topics.startsWith("[")
        ? JSON.parse(post.topics)
        : (post.topics ? [post.topics] : []);

const categories =
    typeof post.categories === "string"
    && post.categories.startsWith("[")
        ? JSON.parse(post.categories)
        : (post.categories ? [post.categories] : []);

            [...topics, ...categories]
            .forEach(tag=>{

                tagCount[tag] =
                    (tagCount[tag] || 0) + 1;
            });
        });

        // 가장 많이 본 태그
        const sortedTags =
            Object.entries(tagCount)
            .sort((a,b)=>b[1]-a[1])
            .map(v=>v[0]);

        if(sortedTags.length === 0){
            return res.json([]);
        }

        // 추천 게시글 조회
        const recommendSql = `
        SELECT
            posts.*,
            COUNT(likes.id) AS like_count
        FROM posts
        LEFT JOIN likes
        ON posts.id = likes.post_id
        WHERE posts.end_date >= CURDATE()
        GROUP BY posts.id
        `;
        db.query(recommendSql, (err, posts)=>{

            const recommended = posts
    .map(post=>{

        const topics =
            typeof post.topics === "string"
            && post.topics.startsWith("[")
                ? JSON.parse(post.topics)
                : (post.topics ? [post.topics] : []);

        const categories =
            typeof post.categories === "string"
            && post.categories.startsWith("[")
                ? JSON.parse(post.categories)
                : (post.categories ? [post.categories] : []);

        const tags =
            [...topics, ...categories];
        // 태그 일치 개수
        let matchCount = 0;

        sortedTags.forEach(tag=>{

            if(tags.includes(tag)){
                matchCount++;
            }
        });

        // 좋아요 수
        const likeCount =
            post.like_count || 0;

        // 조회수
        const views =
            post.views || 0;

        // 추천 점수 계산
        const score =
            (matchCount * 5)
            + (likeCount * 2)
            + (views * 0.5);

        return {
            ...post,
            score
        };
    })

    // 종료 안 된 행사만
    .filter(post=>{

        const today =
            new Date();

        const endDate =
            new Date(post.end_date);

        return endDate >= today;
    })

    // 점수 높은 순
    .sort((a,b)=>b.score - a.score)

    // 상위 6개
    .slice(0, 6);

            res.json(recommended);
        });

    });
});