#!/bin/bash
# API 测试脚本

BASE_URL="http://localhost:9090"

echo "=== Testing My Blog API ==="
echo ""

# 测试健康检查
echo "1. Health Check:"
curl -s "$BASE_URL/api/health" | jq '.'
echo ""
echo ""

# 测试登录
echo "2. Login:"
TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r '.access_token')
echo "Token obtained: ${TOKEN:0:20}..."
echo ""
echo ""

# 测试创建文章
echo "3. Create Article:"
ARTICLE=$(curl -s -X POST "$BASE_URL/api/articles" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title":"Test Article",
    "slug":"test-article",
    "content":"This is a test article.",
    "category":"Tech",
    "tags":["test","demo"],
    "status":"published"
  }')
echo "$ARTICLE" | jq '.'
ARTICLE_ID=$(echo "$ARTICLE" | jq -r '.id')
echo ""
echo ""

# 测试获取文章列表
echo "4. List Articles:"
curl -s "$BASE_URL/api/articles" | jq '.'
echo ""
echo ""

# 测试获取单篇文章
echo "5. Get Article by ID:"
curl -s "$BASE_URL/api/articles/$ARTICLE_ID" | jq '.'
echo ""
echo ""

# 测试更新文章
echo "6. Update Article:"
curl -s -X PUT "$BASE_URL/api/articles/$ARTICLE_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"Updated Test Article"}' | jq '.'
echo ""
echo ""

# 测试删除文章
echo "7. Delete Article:"
curl -s -X DELETE "$BASE_URL/api/articles/$ARTICLE_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -w "\nHTTP Status: %{http_code}\n"
echo ""
echo ""

# 验证删除
echo "8. Verify Deletion:"
curl -s "$BASE_URL/api/articles" | jq '.'
echo ""
echo ""

echo "=== All Tests Completed ==="
