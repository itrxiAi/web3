// leveldown 没有官方类型声明；这里提供最小声明，仅供服务端 RAILGUN 引擎使用。
declare module 'leveldown' {
  const LevelDownDB: (location: string) => unknown;
  export default LevelDownDB;
}
