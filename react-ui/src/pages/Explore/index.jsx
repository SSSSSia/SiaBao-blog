/**
 * 探索页面 — 知识星图 (Constellation)
 * 沉浸式 Canvas + d3-force：节点是技术/话题/仓库，连线是关联，
 * 点击下钻看详情 + AI 洞察，双击钻入子星座。
 */

import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import Constellation from './Constellation';
import './Explore.css';

export default function Explore() {
  return (
    <div className='page'>
      <Header />
      <main className='main'>
        <div className='container'>
          <section className='explore-hero'>
            <h1 className='explore-hero-title'>探索</h1>
            <p className='explore-hero-subtitle'>前沿技术热点追踪</p>
          </section>
          <Constellation />
        </div>
      </main>
      <Footer />
    </div>
  );
}
