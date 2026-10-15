const { S3Client } = require("@aws-sdk/client-s3");

// EC2(Elastic Beanstalk) 인스턴스에 붙은 IAM 역할 자격 증명을 자동으로 쓴다.
// 액세스 키를 코드/환경변수에 따로 넣을 필요가 없다.
const s3 = new S3Client({ region: process.env.AWS_REGION || "ap-northeast-2" });

const AVATAR_BUCKET = process.env.AVATAR_S3_BUCKET || "bomchan-quote-avatars";

module.exports = { s3, AVATAR_BUCKET };
